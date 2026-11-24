// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {CataPayments} from "../lib/CataPayments.sol";
import {ICataConfig} from "../interfaces/ICataConfig.sol";
import {ICataPriceIndex} from "../interfaces/ICataPriceIndex.sol";
import {Features} from "../lib/Features.sol";

/// @title PredictionMarket
/// @notice Parimutuel prediction markets (live rips, pack pools, card prices).
/// Each payment token (BNB = address(0), USDT, $CATA after activation) has its own
/// independent pool per outcome; winners in a token are paid only from that token's pools.
/// The 0.2% fee is taken at bet time; only the net stake enters the pool.
contract PredictionMarket is CataPayments {
    enum Kind { LIVE_RIP, POOL, PRICE }
    enum Status { OPEN, PROPOSED, RESOLVED, CANCELLED }

    struct Market {
        Kind kind;
        Status status;
        uint8 outcomesCount;
        uint8 winningOutcome;
        uint64 closeTime;
        uint64 proposedAt;
        uint64 finalizedAt;
        address creator;
        bytes32 catalogId;   // PRICE markets
        uint256 threshold;   // PRICE markets: USD 18-dec; YES (0) if price >= threshold
        string question;
    }

    uint256 public constant DISPUTE_WINDOW = 24 hours;
    uint8 public constant MAX_OUTCOMES = 16;

    ICataPriceIndex public immutable priceIndex;
    uint256 public minCataToCreate = 100_000 ether;

    Market[] internal _markets;
    // marketId => token => outcome => pool
    mapping(uint256 => mapping(address => mapping(uint8 => uint256))) public outcomePool;
    // marketId => token => total pool
    mapping(uint256 => mapping(address => uint256)) public totalPool;
    // marketId => token => user => outcome => stake
    mapping(uint256 => mapping(address => mapping(address => mapping(uint8 => uint256)))) public stakeOf;
    // marketId => token => user => claimed
    mapping(uint256 => mapping(address => mapping(address => bool))) public claimed;
    // marketId => token => stake already settled by claims (winning stake, or total stake for refunds)
    mapping(uint256 => mapping(address => uint256)) public settledStake;
    // marketId => token => amount paid out by claims
    mapping(uint256 => mapping(address => uint256)) public paidOut;
    // marketId => token => dust swept
    mapping(uint256 => mapping(address => bool)) public dustSwept;

    event MarketCreated(uint256 indexed id, Kind kind, address indexed creator, uint8 outcomes, uint64 closeTime, string question);
    event BetPlaced(uint256 indexed id, address indexed user, uint8 outcome, address token, uint256 gross, uint256 net);
    event ResolutionProposed(uint256 indexed id, uint8 outcome, address indexed by);
    event MarketResolved(uint256 indexed id, uint8 outcome);
    event MarketCancelled(uint256 indexed id);
    event Claimed(uint256 indexed id, address indexed user, address token, uint256 amount);
    event MinCataToCreateSet(uint256 amount);
    event DustSwept(uint256 indexed id, address indexed token, uint256 amount);

    error NotAllowedCreator();
    error BadMarket();
    error BadOutcome();
    error BadToken();
    error Closed();
    error NotClosed();
    error WrongStatus();
    error NotAuthorized();
    error WindowOpen();
    error NothingToClaim();
    error TooEarly();

    constructor(ICataConfig cfg, ICataPriceIndex index) CataPayments(cfg) {
        priceIndex = index;
    }

    // ---------------------------------------------------------------- admin

    function setMinCataToCreate(uint256 amount) external onlyOwner_ {
        minCataToCreate = amount;
        emit MinCataToCreateSet(amount);
    }

    function _isOperatorOrOwner(address a) internal view returns (bool) {
        return a == config.owner() || config.isOperator(a);
    }

    function _canCreate(address a) internal view returns (bool) {
        if (_isOperatorOrOwner(a)) return true;
        if (config.cataActive()) {
            address cata = config.cataToken();
            if (cata != address(0) && IERC20(cata).balanceOf(a) >= minCataToCreate) return true;
        }
        return false;
    }

    // ---------------------------------------------------------------- create

    /// @param resolverData for PRICE: abi.encode(bytes32 catalogId, uint256 threshold18); otherwise ignored.
    function createMarket(Kind kind, string calldata question, uint8 outcomesCount, uint64 closeTime, bytes calldata resolverData)
        external
        whenActive(Features.PREDICTIONS)
        returns (uint256 id)
    {
        if (!_canCreate(msg.sender)) revert NotAllowedCreator();
        if (closeTime <= block.timestamp) revert BadMarket();
        bytes32 catalogId;
        uint256 threshold;
        if (kind == Kind.PRICE) {
            if (outcomesCount != 2) revert BadMarket();
            (catalogId, threshold) = abi.decode(resolverData, (bytes32, uint256));
        } else if (outcomesCount < 2 || outcomesCount > MAX_OUTCOMES) {
            revert BadMarket();
        }
        id = _markets.length;
        _markets.push(Market({
            kind: kind,
            status: Status.OPEN,
            outcomesCount: outcomesCount,
            winningOutcome: 0,
            closeTime: closeTime,
            proposedAt: 0,
            finalizedAt: 0,
            creator: msg.sender,
            catalogId: catalogId,
            threshold: threshold,
            question: question
        }));
        emit MarketCreated(id, kind, msg.sender, outcomesCount, closeTime, question);
    }

    // ---------------------------------------------------------------- bet

    function bet(uint256 id, uint8 outcome, address token, uint256 amount)
        external
        payable
        nonReentrant
        whenActive(Features.PREDICTIONS)
    {
        Market storage m = _market(id);
        if (m.status != Status.OPEN || block.timestamp >= m.closeTime) revert Closed();
        if (outcome >= m.outcomesCount) revert BadOutcome();
        if (!_isAllowedToken(token)) revert BadToken();
        if (amount == 0) revert BadToken();
        if (token != address(0) && msg.value != 0) revert BadToken();
        _pull(token, msg.sender, amount);
        uint256 net = _takeFee(token, amount);
        outcomePool[id][token][outcome] += net;
        totalPool[id][token] += net;
        stakeOf[id][token][msg.sender][outcome] += net;
        emit BetPlaced(id, msg.sender, outcome, token, amount, net);
    }

    // ---------------------------------------------------------------- resolve

    /// @notice PRICE markets: anyone can resolve from the Cata Price Index once a price
    /// updated at/after closeTime exists. YES (0) if price >= threshold else NO (1).
    function resolvePriceMarket(uint256 id) external {
        Market storage m = _market(id);
        if (m.kind != Kind.PRICE) revert WrongStatus();
        if (m.status != Status.OPEN) revert WrongStatus();
        if (block.timestamp < m.closeTime) revert NotClosed();
        (uint256 price, uint64 updatedAt) = priceIndex.priceUsd(m.catalogId);
        if (updatedAt < m.closeTime) revert TooEarly();
        _finalize(id, m, price >= m.threshold ? 0 : 1);
    }

    /// @notice POOL / LIVE_RIP: oracle or operator proposes, final after dispute window.
    function proposeResolution(uint256 id, uint8 outcome) external {
        if (!(config.isOracle(msg.sender) || _isOperatorOrOwner(msg.sender))) revert NotAuthorized();
        Market storage m = _market(id);
        if (m.kind == Kind.PRICE) revert WrongStatus();
        if (m.status != Status.OPEN) revert WrongStatus();
        if (block.timestamp < m.closeTime) revert NotClosed();
        if (outcome >= m.outcomesCount) revert BadOutcome();
        m.status = Status.PROPOSED;
        m.winningOutcome = outcome;
        m.proposedAt = uint64(block.timestamp);
        emit ResolutionProposed(id, outcome, msg.sender);
    }

    /// @notice Owner override during the dispute window (finalizes immediately).
    function overrideResolution(uint256 id, uint8 outcome) external onlyOwner_ {
        Market storage m = _market(id);
        if (m.status != Status.PROPOSED) revert WrongStatus();
        if (block.timestamp >= m.proposedAt + DISPUTE_WINDOW) revert WrongStatus();
        if (outcome >= m.outcomesCount) revert BadOutcome();
        _finalize(id, m, outcome);
    }

    /// @notice Anyone finalizes a proposal after the dispute window.
    function finalize(uint256 id) external {
        Market storage m = _market(id);
        if (m.status != Status.PROPOSED) revert WrongStatus();
        if (block.timestamp < m.proposedAt + DISPUTE_WINDOW) revert WindowOpen();
        _finalize(id, m, m.winningOutcome);
    }

    function cancelMarket(uint256 id) external {
        if (!_isOperatorOrOwner(msg.sender)) revert NotAuthorized();
        Market storage m = _market(id);
        if (m.status == Status.RESOLVED || m.status == Status.CANCELLED) revert WrongStatus();
        m.status = Status.CANCELLED;
        m.finalizedAt = uint64(block.timestamp);
        emit MarketCancelled(id);
    }

    function _finalize(uint256 id, Market storage m, uint8 outcome) internal {
        m.status = Status.RESOLVED;
        m.winningOutcome = outcome;
        m.finalizedAt = uint64(block.timestamp);
        emit MarketResolved(id, outcome);
    }

    // ---------------------------------------------------------------- claim

    /// @dev Returns (payout, stake that this claim settles).
    function _claimable(uint256 id, address token, address user) internal view returns (uint256, uint256) {
        Market storage m = _market(id);
        if (claimed[id][token][user]) return (0, 0);
        if (m.status == Status.CANCELLED) {
            uint256 t = _userTotal(id, token, user, m.outcomesCount);
            return (t, t);
        }
        if (m.status != Status.RESOLVED) return (0, 0);
        uint256 winPool = outcomePool[id][token][m.winningOutcome];
        if (winPool == 0) { // no winners: refund
            uint256 t = _userTotal(id, token, user, m.outcomesCount);
            return (t, t);
        }
        uint256 s = stakeOf[id][token][user][m.winningOutcome];
        return ((s * totalPool[id][token]) / winPool, s);
    }

    function claimable(uint256 id, address token, address user) public view returns (uint256 amount) {
        (amount,) = _claimable(id, token, user);
    }

    /// @notice Claim winnings (or refund) in a given token. Payouts are fee-free here because
    /// the 0.2% fee was already taken when the stake entered the pool. Never expires.
    function claim(uint256 id, address token) external nonReentrant {
        (uint256 amount, uint256 stake) = _claimable(id, token, msg.sender);
        if (amount == 0) revert NothingToClaim();
        claimed[id][token][msg.sender] = true;
        settledStake[id][token] += stake;
        paidOut[id][token] += amount;
        _push(token, msg.sender, amount);
        emit Claimed(id, msg.sender, token, amount);
    }

    function _userTotal(uint256 id, address token, address user, uint8 n) internal view returns (uint256 t) {
        for (uint8 i = 0; i < n; i++) t += stakeOf[id][token][user][i];
    }

    /// @notice Rounding dust left in a finalized market's `token` pool once EVERY winning stake
    /// (or, for refunds, every stake) has been claimed. Sent to the treasury; permissionless.
    /// Unclaimed winnings are never swept: they stay claimable forever.
    function dustOf(uint256 id, address token) public view returns (uint256) {
        Market storage m = _market(id);
        if (dustSwept[id][token]) return 0;
        uint256 target;
        if (m.status == Status.CANCELLED) {
            target = totalPool[id][token];
        } else if (m.status == Status.RESOLVED) {
            uint256 winPool = outcomePool[id][token][m.winningOutcome];
            target = winPool == 0 ? totalPool[id][token] : winPool;
        } else {
            return 0;
        }
        if (settledStake[id][token] != target) return 0;
        return totalPool[id][token] - paidOut[id][token];
    }

    function sweepDust(uint256 id, address token) external nonReentrant {
        uint256 dust = dustOf(id, token);
        if (dust == 0) revert NothingToClaim();
        dustSwept[id][token] = true;
        _push(token, config.treasury(), dust);
        emit DustSwept(id, token, dust);
    }

    // ---------------------------------------------------------------- views

    function marketsCount() external view returns (uint256) { return _markets.length; }

    function getMarket(uint256 id) external view returns (Market memory) { return _market(id); }

    function _market(uint256 id) internal view returns (Market storage) {
        if (id >= _markets.length) revert BadMarket();
        return _markets[id];
    }
}
