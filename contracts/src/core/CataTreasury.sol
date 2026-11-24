// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ICataConfig} from "../interfaces/ICataConfig.sol";
import {IPancakeRouter02} from "../vendor/VRFV2Plus.sol";

/// @title CataTreasury — collects the 20 bps fee in BNB/USDT/CATA and buys back + burns $CATA.
/// @dev 100% of bought $CATA goes to DEAD by default. `rewardsBps` (default 0) lets the owner route a share
///      of bought $CATA to `rewardsVault` (CataPoints) for points conversion, as described in SPEC.
contract CataTreasury is ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public constant DEAD = 0x000000000000000000000000000000000000dEaD;
    uint16 public constant MAX_REWARDS_BPS = 5000;

    ICataConfig public immutable config;
    IPancakeRouter02 public immutable router;

    mapping(address => bool) public isKeeper;
    address public rewardsVault;
    uint16 public rewardsBps; // default 0 => 100% burn

    event BuybackBurned(address indexed tokenIn, uint256 amountIn, uint256 cataBurned, uint256 cataToRewards);
    event KeeperSet(address indexed keeper, bool enabled);
    event RewardsRouteSet(address vault, uint16 bps);

    error NotAuthorized();
    error NotOwner();
    error CataNotActive();
    error BadToken();
    error BadAmount();
    error BadConfig();

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

    function setRewardsRoute(address vault, uint16 bps) external onlyOwner_ {
        if (bps > MAX_REWARDS_BPS || (bps > 0 && vault == address(0))) revert BadConfig();
        rewardsVault = vault;
        rewardsBps = bps;
        emit RewardsRouteSet(vault, bps);
    }

    /// @notice Swap accumulated BNB (token=address(0)) or USDT for $CATA and burn it.
    function buyback(address token, uint256 amountIn, uint256 minOut) external nonReentrant onlyKeeper {
        if (!config.cataActive()) revert CataNotActive();
        address cata = config.cataToken();
        if (amountIn == 0) revert BadAmount();
        address wbnb = router.WETH();
        bool split = rewardsBps > 0;
        address to = split ? address(this) : DEAD;
        uint256 before = split ? IERC20(cata).balanceOf(address(this)) : IERC20(cata).balanceOf(DEAD);

        if (token == address(0)) {
            if (address(this).balance < amountIn) revert BadAmount();
            address[] memory path = new address[](2);
            path[0] = wbnb;
            path[1] = cata;
            router.swapExactETHForTokensSupportingFeeOnTransferTokens{value: amountIn}(
                minOut, path, to, block.timestamp
            );
        } else if (token == config.usdt()) {
            address[] memory path = new address[](3);
            path[0] = token;
            path[1] = wbnb;
            path[2] = cata;
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
