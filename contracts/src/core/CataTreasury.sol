// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ICataConfig} from "../interfaces/ICataConfig.sol";
import {IPancakeRouter02} from "../vendor/VRFV2Plus.sol";

interface IPancakeQuoter {
    function getAmountsOut(uint256 amountIn, address[] calldata path) external view returns (uint256[] memory);
}

interface IHasConfig {
    function config() external view returns (address);
}

/// @title CataTreasury — collects the 20 bps fee in BNB/USDT/CATA and buys back + burns $CATA.
/// @dev The treasury has no withdraw path: fees can only leave as router swaps whose output is burned (DEAD) or,
///      optionally, routed to CataPoints.
///      Rewards route: `rewardsBps` (default 0, hard cap 50%) of each buyback's $CATA goes to `rewardsVault`, which
///      can only ever be the CataPoints contract (set once, then locked). This is what funds the SPEC promise that
///      "points become $CATA" — bought-back $CATA that is paid out to point holders instead of burned.
///      Buyback slippage: the keeper's `minOut` must be within `maxSlippageBps` of the router's spot quote
///      (`getAmountsOut`), and each call is capped at `maxBuybackIn[token]` to bound sandwich size.
///      RESIDUAL RISK: the spot quote is read from the same pool in the same block, so an attacker who controls
///      ordering (sandwich / in-block manipulation) can still move the quote and extract up to
///      `maxSlippageBps` of a capped trade. Keepers should send buyback txs through a private RPC / MEV-protected
///      endpoint and split large balances into multiple small buybacks.
contract CataTreasury is ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public constant DEAD = 0x000000000000000000000000000000000000dEaD;
    uint16 public constant MAX_REWARDS_BPS = 5000;
    uint16 public constant MAX_SLIPPAGE_CAP_BPS = 500;

    ICataConfig public immutable config;
    IPancakeRouter02 public immutable router;

    mapping(address => bool) public isKeeper;
    address public rewardsVault; // CataPoints only; set once, then locked
    uint16 public rewardsBps; // default 0 => 100% burn
    uint16 public maxSlippageBps = 300; // owner-set, <= MAX_SLIPPAGE_CAP_BPS
    mapping(address => uint256) public maxBuybackIn; // token (address(0)=BNB) => per-call cap; 0 = disabled

    event BuybackBurned(address indexed tokenIn, uint256 amountIn, uint256 cataBurned, uint256 cataToRewards);
    event KeeperSet(address indexed keeper, bool enabled);
    event RewardsRouteSet(address vault, uint16 bps);
    event MaxSlippageSet(uint16 bps);
    event MaxBuybackInSet(address indexed token, uint256 maxIn);

    error NotAuthorized();
    error NotOwner();
    error CataNotActive();
    error BadToken();
    error BadAmount();
    error BadConfig();
    error RewardsVaultLocked();
    error MinOutTooLow(uint256 minOut, uint256 floor);
    error AboveMaxBuyback(uint256 amountIn, uint256 maxIn);

    constructor(ICataConfig config_, address router_) {
        config = config_;
        router = IPancakeRouter02(router_);
    }

    receive() external payable {}

    modifier onlyOwner_() {
        if (msg.sender != config.owner()) revert NotOwner();
        _;
    }

    modifier onlyKeeper() {
        if (msg.sender != config.owner() && !isKeeper[msg.sender]) revert NotAuthorized();
        _;
    }

    function setKeeper(address k, bool enabled) external onlyOwner_ {
        isKeeper[k] = enabled;
        emit KeeperSet(k, enabled);
    }

    /// @notice Route `bps` (<= 50%) of bought $CATA to CataPoints to fund points -> $CATA conversion.
    /// @dev The first non-zero `vault` must be a contract sharing this treasury's config (CataPoints) and is then
    ///      locked forever; later calls may only change `bps` and must pass the same vault (or address(0)).
    function setRewardsRoute(address vault, uint16 bps) external onlyOwner_ {
        if (bps > MAX_REWARDS_BPS) revert BadConfig();
        address locked = rewardsVault;
        if (locked == address(0)) {
            if (vault != address(0)) {
                if (vault.code.length == 0) revert BadConfig();
                try IHasConfig(vault).config() returns (address c) {
                    if (c != address(config)) revert BadConfig();
                } catch {
                    revert BadConfig();
                }
                rewardsVault = vault;
                locked = vault;
            } else if (bps > 0) {
                revert BadConfig();
            }
        } else if (vault != address(0) && vault != locked) {
            revert RewardsVaultLocked();
        }
        rewardsBps = bps;
        emit RewardsRouteSet(locked, bps);
    }

    function setMaxSlippageBps(uint16 bps) external onlyOwner_ {
        if (bps > MAX_SLIPPAGE_CAP_BPS) revert BadConfig();
        maxSlippageBps = bps;
        emit MaxSlippageSet(bps);
    }

    /// @notice Per-call cap on buyback input for `token` (address(0) = BNB). 0 disables buybacks of that token.
    function setMaxBuybackIn(address token, uint256 maxIn) external onlyOwner_ {
        maxBuybackIn[token] = maxIn;
        emit MaxBuybackInSet(token, maxIn);
    }

    function _checkMinOut(uint256 amountIn, address[] memory path, uint256 minOut) internal view {
        uint256[] memory amts = IPancakeQuoter(address(router)).getAmountsOut(amountIn, path);
        uint256 floor = (amts[amts.length - 1] * (10_000 - maxSlippageBps)) / 10_000;
        if (minOut < floor || minOut == 0) revert MinOutTooLow(minOut, floor);
    }

    /// @notice Swap accumulated BNB (token=address(0)) or USDT for $CATA and burn it.
    function buyback(address token, uint256 amountIn, uint256 minOut) external nonReentrant onlyKeeper {
        if (!config.cataActive()) revert CataNotActive();
        address cata = config.cataToken();
        if (amountIn == 0) revert BadAmount();
        if (amountIn > maxBuybackIn[token]) revert AboveMaxBuyback(amountIn, maxBuybackIn[token]);
        address wbnb = router.WETH();
        bool split = rewardsBps > 0;
        address to = split ? address(this) : DEAD;
        uint256 before = split ? IERC20(cata).balanceOf(address(this)) : IERC20(cata).balanceOf(DEAD);

        if (token == address(0)) {
            if (address(this).balance < amountIn) revert BadAmount();
            address[] memory path = new address[](2);
            path[0] = wbnb;
            path[1] = cata;
            _checkMinOut(amountIn, path, minOut);
            router.swapExactETHForTokensSupportingFeeOnTransferTokens{value: amountIn}(
                minOut, path, to, block.timestamp
            );
        } else if (token == config.usdt()) {
            address[] memory path = new address[](3);
            path[0] = token;
            path[1] = wbnb;
            path[2] = cata;
            _checkMinOut(amountIn, path, minOut);
            IERC20(token).forceApprove(address(router), amountIn);
            router.swapExactTokensForTokensSupportingFeeOnTransferTokens(amountIn, minOut, path, to, block.timestamp);
        } else {
            revert BadToken();
        }

        uint256 bought = (split ? IERC20(cata).balanceOf(address(this)) : IERC20(cata).balanceOf(DEAD)) - before;
        uint256 toRewards;
        if (split) {
            toRewards = (bought * rewardsBps) / 10_000;
            IERC20(cata).safeTransfer(DEAD, bought - toRewards);
            if (toRewards > 0) IERC20(cata).safeTransfer(rewardsVault, toRewards);
        }
        emit BuybackBurned(token, amountIn, bought - toRewards, toRewards);
    }

    /// @notice $CATA fees need no swap: send the whole balance straight to DEAD.
    function burnCata() external nonReentrant onlyKeeper {
        if (!config.cataActive()) revert CataNotActive();
        address cata = config.cataToken();
        uint256 bal = IERC20(cata).balanceOf(address(this));
        if (bal == 0) revert BadAmount();
        IERC20(cata).safeTransfer(DEAD, bal);
        emit BuybackBurned(cata, bal, bal, 0);
    }
}
