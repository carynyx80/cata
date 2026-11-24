// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {ICataConfig} from "../interfaces/ICataConfig.sol";
import {ICataVault} from "../interfaces/ICataVault.sol";
import {ICataPriceIndex} from "../interfaces/ICataPriceIndex.sol";
import {CataPayments} from "../lib/CataPayments.sol";
import {Features} from "../lib/Features.sol";
import {CataPoints} from "./CataPoints.sol";
import {VRFV2PlusClient, IVRFCoordinatorV2Plus, AggregatorV3Interface} from "../vendor/VRFV2Plus.sol";

/// @title PackMachine — glass pack pools opened with Chainlink VRF v2.5.
/// @notice Every card left in a pool is public (`poolCards`). Buying a pack creates a "credit" (paid, fee taken,
///         one card reserved). Opening a credit requests VRF; the callback pulls a random remaining card.
///         Community stockers are credited their ask (pro-rata in the paid token, minus fee) when their card is
///         pulled; the remaining margin is credited to the company wallet. Payouts are pull-based (`withdraw`)
///         so the VRF callback can never be blocked by a recipient.
contract PackMachine is CataPayments, IERC721Receiver {
    using SafeERC20 for IERC20;

    struct Pool {
        string name;
        uint256 priceUsd; // 18 decimals
        bool active;
        uint256 reserved; // cards reserved by unopened credits / pending VRF
    }

    struct Stock {
        address depositor; // address(0) = company stock
        uint256 askUsd; // 18 decimals, <= pool price
    }

    struct Credit {
        uint256 poolId;
        address token;
        uint256 net; // paid amount after fee
        uint256 priceUsd; // pool price at purchase
        address holder;
        bool used;
    }

    struct Pull {
        address buyer;
        uint64 pulledAt;
        bool soldBack;
    }

    uint16 public constant SELLBACK_BPS = 8500;

    ICataVault public immutable vault;
    ICataPriceIndex public immutable priceIndex;
    CataPoints public immutable pointsContract;

    // VRF v2.5
    IVRFCoordinatorV2Plus public coordinator;
    bytes32 public keyHash;
    uint256 public subId;
    uint16 public requestConfirmations = 3;
    uint32 public callbackGasLimit = 300_000;

    AggregatorV3Interface public bnbUsdFeed;
    uint256 public maxFeedAge = 1 hours;
    uint256 public maxIndexAge = 7 days;
    uint256 public sellbackWindow = 1 hours;
    uint256 public pointsPerOpen = 10;
    uint256 public sellbackReserve; // USDT

    Pool[] private _pools;
    mapping(uint256 => uint256[]) private _poolCards;
    mapping(uint256 => uint256) public poolOfToken; // poolId + 1, 0 = none
    mapping(uint256 => Stock) public stockOf;
    Credit[] private _credits;
    mapping(uint256 => uint256) public requestCredit; // vrf requestId => creditId + 1
    mapping(uint256 => address) public requestRecipient;
    mapping(uint256 => Pull) public pulls; // tokenId => last pull
    mapping(address => mapping(address => uint256)) public owed; // token => account => amount

    event PoolCreated(uint256 indexed poolId, string name, uint256 priceUsd);
    event PoolUpdated(uint256 indexed poolId, uint256 priceUsd, bool active);
    event CardDeposited(uint256 indexed poolId, uint256 indexed tokenId, address indexed depositor, uint256 askUsd);
    event CardWithdrawn(uint256 indexed poolId, uint256 indexed tokenId, address indexed to);
    event CreditBought(uint256 indexed creditId, uint256 indexed poolId, address indexed holder, address token, uint256 paid);
    event CreditTransferred(uint256 indexed creditId, address indexed to);
    event OpenRequested(uint256 indexed creditId, uint256 indexed requestId, address indexed recipient);
    event PackOpened(uint256 indexed creditId, uint256 indexed poolId, address indexed recipient, uint256 tokenId);
    event SoldBack(uint256 indexed tokenId, address indexed seller, uint256 usdtPaid);
    event ReserveFunded(uint256 amount);
    event Withdrawn(address indexed token, address indexed account, uint256 amount);

    error BadPool();
    error PoolEmpty();
    error BadAsk();
    error NotDepositor();
    error NotHolder();
    error CreditUsed();
    error OnlyCoordinator();
    error UnknownRequest();
    error StaleFeed();
    error SellbackClosed();
    error NoPrice();
    error InsufficientReserve();
    error Reserved();
    error NotOperator();

    constructor(
        ICataConfig config_,
        ICataVault vault_,
        ICataPriceIndex index_,
        CataPoints points_,
        address coordinator_,
        bytes32 keyHash_,
        uint256 subId_,
        address bnbUsdFeed_
    ) CataPayments(config_) {
        vault = vault_;
        priceIndex = index_;
        pointsContract = points_;
        coordinator = IVRFCoordinatorV2Plus(coordinator_);
        keyHash = keyHash_;
        subId = subId_;
        bnbUsdFeed = AggregatorV3Interface(bnbUsdFeed_);
    }

    // ---------------------------------------------------------------- admin

    function setVrf(address coordinator_, bytes32 keyHash_, uint256 subId_, uint16 confirmations, uint32 gasLimit)
        external
        onlyOwner_
    {
        coordinator = IVRFCoordinatorV2Plus(coordinator_);
        keyHash = keyHash_;
        subId = subId_;
        requestConfirmations = confirmations;
        callbackGasLimit = gasLimit;
    }

    function setParams(address feed, uint256 feedAge, uint256 indexAge, uint256 window, uint256 ptsPerOpen)
        external
        onlyOwner_
    {
        bnbUsdFeed = AggregatorV3Interface(feed);
        maxFeedAge = feedAge;
        maxIndexAge = indexAge;
        sellbackWindow = window;
        pointsPerOpen = ptsPerOpen;
    }

    function createPool(string calldata name, uint256 priceUsd) external onlyOwner_ returns (uint256 poolId) {
        if (priceUsd == 0) revert BadPool();
        poolId = _pools.length;
        _pools.push(Pool(name, priceUsd, true, 0));
        emit PoolCreated(poolId, name, priceUsd);
    }

    function updatePool(uint256 poolId, uint256 priceUsd, bool active) external onlyOwner_ {
        if (poolId >= _pools.length || priceUsd == 0) revert BadPool();
        _pools[poolId].priceUsd = priceUsd;
        _pools[poolId].active = active;
        emit PoolUpdated(poolId, priceUsd, active);
    }

    function fundSellbackReserve(uint256 amount) external nonReentrant {
        IERC20(config.usdt()).safeTransferFrom(msg.sender, address(this), amount);
        sellbackReserve += amount;
        emit ReserveFunded(amount);
    }

    function withdrawReserve(uint256 amount) external onlyOwner_ nonReentrant {
        if (amount > sellbackReserve) revert InsufficientReserve();
        sellbackReserve -= amount;
        IERC20(config.usdt()).safeTransfer(config.companyWallet(), amount);
    }

    // ---------------------------------------------------------------- views

    function poolCount() external view returns (uint256) {
        return _pools.length;
    }

    function pools(uint256 poolId) external view returns (Pool memory) {
        return _pools[poolId];
    }

    function poolCards(uint256 poolId) external view returns (uint256[] memory) {
        return _poolCards[poolId];
    }

    function available(uint256 poolId) public view returns (uint256) {
        return _poolCards[poolId].length - _pools[poolId].reserved;
    }

    function credits(uint256 creditId) external view returns (Credit memory) {
        return _credits[creditId];
    }

    /// @notice Amount of `token` needed to buy one pack. USDT is 1:1 with USD (both 18 dec on BSC).
    function quote(uint256 poolId, address token) public view returns (uint256) {
        uint256 usd = _pools[poolId].priceUsd;
        if (token == config.usdt()) return usd;
        if (token != address(0)) revert TokenNotAllowed(token);
        (, int256 answer,, uint256 updatedAt,) = bnbUsdFeed.latestRoundData();
        if (answer <= 0 || block.timestamp - updatedAt > maxFeedAge) revert StaleFeed();
        uint8 dec = bnbUsdFeed.decimals();
        // wei = usd18 * 10^dec / answer, rounded up
        return (usd * (10 ** dec) + uint256(answer) - 1) / uint256(answer);
    }

    function sellbackQuote(uint256 tokenId) public view returns (uint256) {
        (uint256 p, uint64 at) = priceIndex.priceUsd(vault.catalogIdOf(tokenId));
        if (p == 0 || block.timestamp - at > maxIndexAge) revert NoPrice();
        return (p * SELLBACK_BPS) / 10_000;
    }

    // ---------------------------------------------------------------- stocking

    /// @notice Operator stocks company cards (from msg.sender) into a pool.
    function stockPool(uint256 poolId, uint256[] calldata tokenIds) external nonReentrant {
        if (!config.isOperator(msg.sender)) revert NotOperator();
        if (poolId >= _pools.length) revert BadPool();
        for (uint256 i; i < tokenIds.length; ++i) {
            _addCard(poolId, tokenIds[i], address(0), 0);
        }
    }

    /// @notice Community stocking: deposit a slab, get paid `askPriceUsd` (pro-rata in the paid token) when pulled.
    function depositToPool(uint256 poolId, uint256 tokenId, uint256 askPriceUsd)
        external
        nonReentrant
        whenActive(Features.PACKS)
    {
        if (poolId >= _pools.length || !_pools[poolId].active) revert BadPool();
        if (askPriceUsd == 0 || askPriceUsd > _pools[poolId].priceUsd) revert BadAsk();
        _addCard(poolId, tokenId, msg.sender, askPriceUsd);
    }

    /// @notice Depositor (or operator for company stock) withdraws an unpulled card, if not needed by reservations.
    function withdrawFromPool(uint256 tokenId) external nonReentrant {
        uint256 p1 = poolOfToken[tokenId];
        if (p1 == 0) revert BadPool();
        uint256 poolId = p1 - 1;
        Stock memory s = stockOf[tokenId];
        if (s.depositor == address(0) ? !config.isOperator(msg.sender) : s.depositor != msg.sender) {
            revert NotDepositor();
        }
        if (available(poolId) == 0) revert Reserved();
        uint256[] storage cards = _poolCards[poolId];
        for (uint256 i; i < cards.length; ++i) {
            if (cards[i] == tokenId) {
                _removeAt(poolId, i);
                break;
            }
        }
        vault.safeTransferFrom(address(this), msg.sender, tokenId);
        emit CardWithdrawn(poolId, tokenId, msg.sender);
    }

    function _addCard(uint256 poolId, uint256 tokenId, address depositor, uint256 ask) internal {
        vault.transferFrom(msg.sender, address(this), tokenId);
        _poolCards[poolId].push(tokenId);
        poolOfToken[tokenId] = poolId + 1;
        stockOf[tokenId] = Stock(depositor, ask);
        emit CardDeposited(poolId, tokenId, depositor, ask);
    }

    function _removeAt(uint256 poolId, uint256 i) internal returns (uint256 tokenId) {
        uint256[] storage cards = _poolCards[poolId];
        tokenId = cards[i];
        cards[i] = cards[cards.length - 1];
        cards.pop();
        delete poolOfToken[tokenId];
    }

    // ---------------------------------------------------------------- buying / opening

    /// @notice Buy a pack credit for `to` (e.g. GiftPacks). BNB: send >= quote, excess refunded to msg.sender.
    function buyCredit(uint256 poolId, address token, address to)
        external
        payable
        nonReentrant
        whenActive(Features.PACKS)
        returns (uint256 creditId)
    {
        creditId = _buyCredit(poolId, token, to);
    }

    /// @notice Buy and open one pack for msg.sender.
    function open(uint256 poolId, address token)
        external
        payable
        nonReentrant
        whenActive(Features.PACKS)
        returns (uint256 requestId)
    {
        uint256 creditId = _buyCredit(poolId, token, msg.sender);
        requestId = _openCredit(creditId, msg.sender);
    }

    /// @notice Open a credit you hold; the pulled card goes to `recipient`.
    function openCredit(uint256 creditId, address recipient)
        external
        nonReentrant
        whenActive(Features.PACKS)
        returns (uint256)
    {
        if (_credits[creditId].holder != msg.sender) revert NotHolder();
        return _openCredit(creditId, recipient);
    }

    function transferCredit(uint256 creditId, address to) external {
        Credit storage c = _credits[creditId];
        if (c.holder != msg.sender) revert NotHolder();
        if (c.used) revert CreditUsed();
        c.holder = to;
        emit CreditTransferred(creditId, to);
    }

    function _buyCredit(uint256 poolId, address token, address to) internal returns (uint256 creditId) {
        if (poolId >= _pools.length || !_pools[poolId].active) revert BadPool();
        if (token != address(0) && token != config.usdt()) revert TokenNotAllowed(token);
        if (available(poolId) == 0) revert PoolEmpty();
        uint256 amount = quote(poolId, token);
        if (token == address(0)) {
            if (msg.value < amount) revert BadMsgValue();
            uint256 refund = msg.value - amount;
            if (refund > 0) _push(address(0), msg.sender, refund);
        } else {
            _pull(token, msg.sender, amount);
        }
        uint256 net = _takeFee(token, amount);
        _pools[poolId].reserved += 1;
        creditId = _credits.length;
        _credits.push(Credit(poolId, token, net, _pools[poolId].priceUsd, to, false));
        if (pointsPerOpen > 0) pointsContract.award(to, pointsPerOpen);
        emit CreditBought(creditId, poolId, to, token, amount);
    }

    function _openCredit(uint256 creditId, address recipient) internal returns (uint256 requestId) {
        Credit storage c = _credits[creditId];
        if (c.used) revert CreditUsed();
        c.used = true;
        requestId = coordinator.requestRandomWords(
            VRFV2PlusClient.RandomWordsRequest({
                keyHash: keyHash,
                subId: subId,
                requestConfirmations: requestConfirmations,
                callbackGasLimit: callbackGasLimit,
                numWords: 1,
                extraArgs: VRFV2PlusClient._argsToBytes(VRFV2PlusClient.ExtraArgsV1({nativePayment: false}))
            })
        );
        requestCredit[requestId] = creditId + 1;
        requestRecipient[requestId] = recipient;
        emit OpenRequested(creditId, requestId, recipient);
    }

    /// @notice Chainlink VRF v2.5 callback entry point.
    function rawFulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) external {
        if (msg.sender != address(coordinator)) revert OnlyCoordinator();
        uint256 c1 = requestCredit[requestId];
        if (c1 == 0) revert UnknownRequest();
        delete requestCredit[requestId];
        address recipient = requestRecipient[requestId];
        delete requestRecipient[requestId];
        Credit memory c = _credits[c1 - 1];

        uint256[] storage cards = _poolCards[c.poolId];
        uint256 tokenId = _removeAt(c.poolId, randomWords[0] % cards.length);
        _pools[c.poolId].reserved -= 1;

        Stock memory s = stockOf[tokenId];
        delete stockOf[tokenId];
        uint256 margin = c.net;
        if (s.depositor != address(0)) {
            uint256 gross = (c.net * s.askUsd) / c.priceUsd;
            if (gross > margin) gross = margin;
            margin -= gross;
            uint256 fee = (gross * config.feeBps()) / 10_000;
            owed[c.token][config.treasury()] += fee;
            owed[c.token][s.depositor] += gross - fee;
        }
        owed[c.token][config.companyWallet()] += margin;

        pulls[tokenId] = Pull(recipient, uint64(block.timestamp), false);
        // plain transferFrom: a receiver contract can never block the VRF callback
        vault.transferFrom(address(this), recipient, tokenId);
        emit PackOpened(c1 - 1, c.poolId, recipient, tokenId);
    }

    /// @notice Withdraw accrued revenue / depositor payouts / fees (fees accrue to treasury address).
    function withdraw(address token) external nonReentrant {
        uint256 amt = owed[token][msg.sender];
        owed[token][msg.sender] = 0;
        _push(token, msg.sender, amt);
        emit Withdrawn(token, msg.sender, amt);
    }

    /// @notice Anyone may flush accrued fees to the treasury.
    function flushFees(address token) external nonReentrant {
        address t = config.treasury();
        uint256 amt = owed[token][t];
        owed[token][t] = 0;
        _push(token, t, amt);
        if (amt > 0) emit FeeTaken(token, amt);
    }

    /// @notice Return a freshly pulled card within the window for 85% of its Cata Price Index value, in USDT.
    function sellBack(uint256 tokenId) external nonReentrant whenActive(Features.PACKS) returns (uint256 net) {
        Pull storage p = pulls[tokenId];
        if (p.buyer != msg.sender || p.soldBack || block.timestamp > p.pulledAt + sellbackWindow) {
            revert SellbackClosed();
        }
        uint256 gross = sellbackQuote(tokenId);
        if (gross > sellbackReserve) revert InsufficientReserve();
        p.soldBack = true;
        sellbackReserve -= gross;
        vault.transferFrom(msg.sender, config.companyWallet(), tokenId);
        address usdt = config.usdt();
        net = _takeFee(usdt, gross);
        _push(usdt, msg.sender, net);
        emit SoldBack(tokenId, msg.sender, net);
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
}
