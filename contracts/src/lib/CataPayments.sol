// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ICataConfig} from "../interfaces/ICataConfig.sol";

/// @notice Shared payment helpers. address(0) means native BNB.
abstract contract CataPayments is ReentrancyGuard {
    using SafeERC20 for IERC20;

    ICataConfig public immutable config;

    event FeeTaken(address indexed token, uint256 fee);

    error Paused();
    error FeatureDisabled(bytes32 feature);
    error NotOwner();
    error TokenNotAllowed(address token);
    error BadMsgValue();
    error NativeTransferFailed();
    error TreasuryNotSet();

    constructor(ICataConfig config_) {
        config = config_;
    }

    modifier whenActive(bytes32 feature) {
        if (config.paused()) revert Paused();
        if (!config.featureEnabled(feature)) revert FeatureDisabled(feature);
        _;
    }

    modifier onlyOwner_() {
        if (msg.sender != config.owner()) revert NotOwner();
        _;
    }

    function _isAllowedToken(address token) internal view returns (bool) {
        if (token == address(0) || token == config.usdt()) return true;
        return config.cataActive() && token == config.cataToken();
    }

    function _pull(address token, address from, uint256 amount) internal {
        if (token == address(0)) {
            if (msg.value != amount) revert BadMsgValue();
        } else {
            if (msg.value != 0) revert BadMsgValue();
            if (amount > 0) IERC20(token).safeTransferFrom(from, address(this), amount);
        }
    }

    function _push(address token, address to, uint256 amount) internal {
        if (amount == 0) return;
        if (token == address(0)) {
            (bool ok,) = payable(to).call{value: amount}("");
            if (!ok) revert NativeTransferFailed();
        } else {
            IERC20(token).safeTransfer(to, amount);
        }
    }

    function _takeFee(address token, uint256 amount) internal returns (uint256 net) {
        uint256 fee = (amount * config.feeBps()) / 10_000;
        if (fee > 0) {
            address t = config.treasury();
            if (t == address(0)) revert TreasuryNotSet();
            _push(token, t, fee);
            emit FeeTaken(token, fee);
        }
        net = amount - fee;
    }
}
