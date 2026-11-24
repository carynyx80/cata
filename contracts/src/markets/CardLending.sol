// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {CataPayments} from "../lib/CataPayments.sol";
import {ICataConfig} from "../interfaces/ICataConfig.sol";
import {ICataVault} from "../interfaces/ICataVault.sol";
import {ICataPriceIndex} from "../interfaces/ICataPriceIndex.sol";
import {Features} from "../lib/Features.sol";
import {IAggregatorV3} from "./IAggregatorV3.sol";

/// @title CardLending
/// @notice Borrow USDT or BNB against graded-card vault NFTs, priced by the Cata Price Index.
/// Lenders supply liquidity per token into a simple pooled vault (shares). Fixed APR accrues per
/// second on principal. 0.2% fee on lender deposits, on the borrowed amount (borrower receives
/// net) and on repay/liquidation payments (payer covers it). Lender withdrawals are fee-free.
///
/// Share price: totalAssets = cash + outstanding principal + interest accrued so far (computed in
/// O(1) from per-token running sums), so depositors joining just before a large repay do not
/// capture interest accrued before they joined. Each loan snapshots the APR at borrow time.
///
/// Liquidation: when debt > liqThresholdBps of collateral value, or the loan is past due, anyone
/// pays the debt and receives the NFT. If nobody does within WRITE_OFF_GRACE after the due date,
/// anyone can `writeOff` the loan: lenders absorb the loss (lower share price, withdrawals keep
/// working) and the NFT goes to the company wallet to be sold; sale proceeds are returned to the
/// pool via `donate`.
contract CardLending is CataPayments, IERC721Receiver {
    struct Loan {
        address borrower;
        address token;
        uint256 principal;
        uint64 start;
        uint64 due;
        bool active;
        uint16 aprBps; // APR snapshot at borrow time
    }

    struct Pool {
        uint256 cash;        // liquid assets held for lenders
        uint256 borrowed;    // outstanding principal (Σ principal_i)
        uint256 totalShares;
        uint256 sumPrincipalApr;      // Σ principal_i · apr_i
        uint256 sumPrincipalAprStart; // Σ principal_i · apr_i · start_i
    }

    uint256 public constant BPS = 10_000;
    uint256 public constant YEAR = 365 days;
    uint256 public constant WRITE_OFF_GRACE = 7 days;
    /// @dev virtual shares/assets offset (ERC4626-style) so donations cannot be used for a
    /// first-depositor share-inflation attack.
    uint256 internal constant VIRTUAL_SHARES = 1e6;
    uint256 internal constant VIRTUAL_ASSETS = 1;

    ICataVault public immutable vault;
    ICataPriceIndex public immutable priceIndex;
    IAggregatorV3 public bnbUsdFeed;

    uint16 public ltvBps = 4_000;
    uint16 public liqThresholdBps = 6_000;
    uint16 public aprBps = 1_500;
    uint64 public loanDuration = 30 days;
    uint64 public maxPriceAge = 3 days;

    mapping(address => Pool) public pools;
    mapping(address => mapping(address => uint256)) public sharesOf; // token => lender => shares
    mapping(uint256 => Loan) public loans; // vault tokenId => loan

    event ParamsSet(uint16 ltvBps, uint16 liqThresholdBps, uint16 aprBps, uint64 loanDuration, uint64 maxPriceAge);
    event FeedSet(address feed);
    event Deposited(address indexed token, address indexed lender, uint256 net, uint256 shares);
    event Withdrawn(address indexed token, address indexed lender, uint256 amount, uint256 shares);
    event Borrowed(uint256 indexed tokenId, address indexed borrower, address token, uint256 principal, uint256 netReceived, uint64 due);
    event Repaid(uint256 indexed tokenId, address indexed payer, uint256 debt);
    event Liquidated(uint256 indexed tokenId, address indexed liquidator, uint256 debt);
    event WrittenOff(uint256 indexed tokenId, address indexed token, uint256 debtLost, address collateralTo);
    event Donated(address indexed token, address indexed from, uint256 amount);

    error BadToken();
    error BadParams();
    error StalePrice();
    error ExceedsLtv();
    error NoLiquidity();
    error NoLoan();
    error NotBorrower();
    error Healthy();
    error Insufficient();
    error NotWritable();

    constructor(ICataConfig cfg, ICataVault vault_, ICataPriceIndex index, IAggregatorV3 bnbFeed) CataPayments(cfg) {
        vault = vault_;
        priceIndex = index;
        bnbUsdFeed = bnbFeed;
    }

    // ------------------------------------------------------------ admin

    function setParams(uint16 ltv, uint16 liq, uint16 apr, uint64 duration, uint64 priceAge) external onlyOwner_ {
        if (ltv == 0 || ltv >= liq || liq > BPS || duration == 0 || priceAge == 0) revert BadParams();
        (ltvBps, liqThresholdBps, aprBps, loanDuration, maxPriceAge) = (ltv, liq, apr, duration, priceAge);
        emit ParamsSet(ltv, liq, apr, duration, priceAge);
    }

    function setBnbUsdFeed(IAggregatorV3 feed) external onlyOwner_ {
        bnbUsdFeed = feed;
        emit FeedSet(address(feed));
    }

    // ------------------------------------------------------------ tokens

    /// @dev Lending supports BNB and USDT only (not $CATA).
    function _lendable(address token) internal view returns (bool) {
        return token == address(0) || token == config.usdt();
    }

    /// @notice Convert a USD (18-dec) value into `token` units.
    function usdToToken(address token, uint256 usd18) public view returns (uint256 amount, uint256 updatedAt) {
        if (token == address(0)) {
            (, int256 answer,, uint256 upd,) = bnbUsdFeed.latestRoundData();
            if (answer <= 0) revert StalePrice();
            uint8 d = bnbUsdFeed.decimals();
            // BNB has 18 decimals: amount = usd18 * 10^d / answer
            return ((usd18 * (10 ** d)) / uint256(answer), upd);
        }
        uint8 dec = IERC20Metadata(token).decimals();
        amount = dec >= 18 ? usd18 * (10 ** (dec - 18)) : usd18 / (10 ** (18 - dec));
        return (amount, block.timestamp);
    }

    /// @notice Collateral value of a vault NFT in `token` units, plus oldest timestamp of the inputs.
    function collateralValue(uint256 tokenId, address token) public view returns (uint256 value, uint256 updatedAt) {
        (uint256 usd, uint64 upd) = priceIndex.priceUsd(vault.catalogIdOf(tokenId));
        (uint256 v, uint256 upd2) = usdToToken(token, usd);
        return (v, upd < upd2 ? upd : upd2);
    }

    // ------------------------------------------------------------ lenders

    /// @notice Interest accrued (not yet paid) across all open loans in `token`.
    function accruedInterest(address token) public view returns (uint256) {
        Pool storage p = pools[token];
        // Σ p_i·apr_i·(now − start_i) / (BPS·YEAR); start_i <= now so this never underflows
        return (block.timestamp * p.sumPrincipalApr - p.sumPrincipalAprStart) / (BPS * YEAR);
    }

    function totalAssets(address token) public view returns (uint256) {
        Pool storage p = pools[token];
        return p.cash + p.borrowed + accruedInterest(token);
    }

    /// @notice Assets currently redeemable by `shares` of `token`'s pool.
    function previewWithdraw(address token, uint256 shares) public view returns (uint256) {
        return (shares * (totalAssets(token) + VIRTUAL_ASSETS)) / (pools[token].totalShares + VIRTUAL_SHARES);
    }

    function deposit(address token, uint256 amount) external payable nonReentrant whenActive(Features.LENDING) {
        if (!_lendable(token) || amount == 0) revert BadToken();
        if (token != address(0) && msg.value != 0) revert BadToken();
        _pull(token, msg.sender, amount);
        uint256 net = _takeFee(token, amount);
        Pool storage p = pools[token];
        uint256 shares = (net * (p.totalShares + VIRTUAL_SHARES)) / (totalAssets(token) + VIRTUAL_ASSETS);
        if (shares == 0) revert Insufficient();
        p.cash += net;
        p.totalShares += shares;
        sharesOf[token][msg.sender] += shares;
        emit Deposited(token, msg.sender, net, shares);
    }

    function withdraw(address token, uint256 shares) external nonReentrant {
        Pool storage p = pools[token];
        if (shares == 0 || sharesOf[token][msg.sender] < shares) revert Insufficient();
        uint256 amount = previewWithdraw(token, shares);
        if (amount > p.cash) revert NoLiquidity();
        sharesOf[token][msg.sender] -= shares;
        p.totalShares -= shares;
        p.cash -= amount;
        _push(token, msg.sender, amount);
        emit Withdrawn(token, msg.sender, amount, shares);
    }

    /// @notice Add funds to `token`'s pool for lenders (e.g. proceeds from selling written-off
    /// collateral). Raises the share price; no shares are minted. Fee-free: not a trade.
    function donate(address token, uint256 amount) external payable nonReentrant {
        if (!_lendable(token) || amount == 0) revert BadToken();
        _pull(token, msg.sender, amount);
        pools[token].cash += amount;
        emit Donated(token, msg.sender, amount);
    }

    // ------------------------------------------------------------ borrowers

    /// @notice Deposit a vault NFT (requires approval) and borrow `amount` of `token` (BNB/USDT).
    function borrow(uint256 tokenId, address token, uint256 amount) external nonReentrant whenActive(Features.LENDING) {
        if (!_lendable(token) || amount == 0) revert BadToken();
        if (loans[tokenId].active) revert BadParams();
        (uint256 value, uint256 upd) = collateralValue(tokenId, token);
        if (block.timestamp > upd + maxPriceAge) revert StalePrice();
        if (amount > (value * ltvBps) / BPS) revert ExceedsLtv();
        Pool storage p = pools[token];
        if (amount > p.cash) revert NoLiquidity();

        vault.transferFrom(msg.sender, address(this), tokenId);
        uint64 due = uint64(block.timestamp) + loanDuration;
        uint16 apr = aprBps;
        loans[tokenId] = Loan({borrower: msg.sender, token: token, principal: amount, start: uint64(block.timestamp), due: due, active: true, aprBps: apr});
        p.cash -= amount;
        p.borrowed += amount;
        p.sumPrincipalApr += amount * apr;
        p.sumPrincipalAprStart += amount * apr * block.timestamp;

        uint256 net = _takeFee(token, amount);
        _push(token, msg.sender, net);
        emit Borrowed(tokenId, msg.sender, token, amount, net, due);
    }

    function debtOf(uint256 tokenId) public view returns (uint256) {
        Loan storage l = loans[tokenId];
        if (!l.active) return 0;
        uint256 dt = block.timestamp - l.start;
        return l.principal + (l.principal * l.aprBps * dt) / (BPS * YEAR);
    }

    /// @notice Gross amount to send so that the post-fee amount covers the debt (with a small buffer
    /// for interest accruing until the tx is mined). Excess is refunded.
    function payQuote(uint256 tokenId, uint256 bufferSeconds) external view returns (uint256) {
        Loan storage l = loans[tokenId];
        if (!l.active) return 0;
        uint256 dt = block.timestamp + bufferSeconds - l.start;
        uint256 debt = l.principal + (l.principal * l.aprBps * dt) / (BPS * YEAR);
        uint256 fee = config.feeBps();
        return (debt * BPS + (BPS - fee) - 1) / (BPS - fee) + 1;
    }

    function isLiquidatable(uint256 tokenId) public view returns (bool) {
        Loan storage l = loans[tokenId];
        if (!l.active) return false;
        if (block.timestamp > l.due) return true;
        (uint256 value, uint256 upd) = collateralValue(tokenId, l.token);
        // never price-liquidate on a stale index/feed value (overdue loans stay liquidatable above)
        if (block.timestamp > upd + maxPriceAge) return false;
        return debtOf(tokenId) * BPS > value * liqThresholdBps;
    }

    /// @notice Repay the full debt (gross `amount` incl. 0.2% fee) and get the NFT back.
    function repay(uint256 tokenId, uint256 amount) external payable nonReentrant {
        Loan storage l = loans[tokenId];
        if (!l.active) revert NoLoan();
        if (msg.sender != l.borrower) revert NotBorrower();
        uint256 debt = _settle(tokenId, l, amount);
        vault.safeTransferFrom(address(this), msg.sender, tokenId);
        emit Repaid(tokenId, msg.sender, debt);
    }

    /// @notice Pay off an unhealthy or overdue loan and receive the collateral NFT.
    function liquidate(uint256 tokenId, uint256 amount) external payable nonReentrant {
        Loan storage l = loans[tokenId];
        if (!l.active) revert NoLoan();
        if (!isLiquidatable(tokenId)) revert Healthy();
        uint256 debt = _settle(tokenId, l, amount);
        vault.safeTransferFrom(address(this), msg.sender, tokenId);
        emit Liquidated(tokenId, msg.sender, debt);
    }

    function _settle(uint256 tokenId, Loan storage l, uint256 amount) internal returns (uint256 debt) {
        address token = l.token;
        if (token != address(0) && msg.value != 0) revert BadToken();
        debt = debtOf(tokenId);
        _pull(token, msg.sender, amount);
        uint256 net = _takeFee(token, amount);
        if (net < debt) revert Insufficient();
        _closeLoan(l);
        pools[token].cash += debt;
        if (net > debt) _push(token, msg.sender, net - debt);
    }

    /// @dev Remove a loan's principal and accrued interest from the pool's accounting.
    function _closeLoan(Loan storage l) internal {
        Pool storage p = pools[l.token];
        uint256 pa = l.principal * l.aprBps;
        p.borrowed -= l.principal;
        p.sumPrincipalApr -= pa;
        p.sumPrincipalAprStart -= pa * l.start;
        l.active = false;
    }

    /// @notice Bad debt: once a loan is WRITE_OFF_GRACE past due and still open (nobody
    /// liquidated it), anyone can write it off. The debt is removed from the pool (lenders absorb
    /// the loss through a lower share price) and the NFT goes to the company wallet to be sold;
    /// proceeds should be returned to lenders via `donate`.
    function writeOff(uint256 tokenId) external nonReentrant {
        Loan storage l = loans[tokenId];
        if (!l.active) revert NoLoan();
        if (block.timestamp <= uint256(l.due) + WRITE_OFF_GRACE) revert NotWritable();
        uint256 debt = debtOf(tokenId);
        address token = l.token;
        _closeLoan(l);
        address company = config.companyWallet();
        vault.transferFrom(address(this), company, tokenId);
        emit WrittenOff(tokenId, token, debt, company);
    }

    function onERC721Received(address, address, uint256, bytes calldata) external view returns (bytes4) {
        if (msg.sender != address(vault)) revert BadToken();
        return IERC721Receiver.onERC721Received.selector;
    }
}
