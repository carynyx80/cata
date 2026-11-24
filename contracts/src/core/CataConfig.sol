// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ICataConfig} from "../interfaces/ICataConfig.sol";
import {Features} from "../lib/Features.sol";

/// @title CataConfig — global settings, roles, feature flags and the one-time $CATA activation lock.
contract CataConfig is ICataConfig, Ownable {
    uint16 public constant MAX_FEE_BPS = 100;

    address public treasury;
    address public companyWallet;
    address public immutable usdt;
    address public cataToken; // address(0) until activateCata; then locked forever
    uint16 public feeBps = 20;
    bool public paused;

    mapping(bytes32 => bool) private _features;
    mapping(address => bool) public isOracle;
    mapping(address => bool) public isOperator;

    event CataActivated(address indexed token);
    event TreasurySet(address treasury);
    event CompanyWalletSet(address wallet);
    event FeeBpsSet(uint16 feeBps);
    event PausedSet(bool paused);
    event FeatureSet(bytes32 indexed feature, bool enabled);
    event OracleSet(address indexed account, bool enabled);
    event OperatorSet(address indexed account, bool enabled);

    error ZeroAddress();
    error AlreadyActivated();
    error FeeTooHigh();

    constructor(address owner_, address companyWallet_, address usdt_, address treasury_) Ownable(owner_) {
        if (companyWallet_ == address(0) || usdt_ == address(0)) revert ZeroAddress();
        companyWallet = companyWallet_;
        usdt = usdt_;
        treasury = treasury_ == address(0) ? companyWallet_ : treasury_;
        _features[Features.PACKS] = true;
        _features[Features.MARKET] = true;
        _features[Features.GIFTS] = true;
        _features[Features.SETS] = true;
        _features[Features.LENDING] = true;
        _features[Features.LIVE_RIPS] = true;
        // PREDICTIONS, BATTLES, FRACTIONAL default off
    }

    function owner() public view override(ICataConfig, Ownable) returns (address) {
        return Ownable.owner();
    }

    function cataActive() public view returns (bool) {
        return cataToken != address(0);
    }

    function featureEnabled(bytes32 feature) external view returns (bool) {
        return _features[feature];
    }

    /// @notice One-time, irreversible activation of $CATA.
    function activateCata(address token) external onlyOwner {
        if (token == address(0)) revert ZeroAddress();
        if (cataToken != address(0)) revert AlreadyActivated();
        cataToken = token;
        emit CataActivated(token);
    }

    function setTreasury(address t) external onlyOwner {
        if (t == address(0)) revert ZeroAddress();
        treasury = t;
        emit TreasurySet(t);
    }

    function setCompanyWallet(address w) external onlyOwner {
        if (w == address(0)) revert ZeroAddress();
        companyWallet = w;
        emit CompanyWalletSet(w);
    }

    function setFeeBps(uint16 bps) external onlyOwner {
        if (bps > MAX_FEE_BPS) revert FeeTooHigh();
        feeBps = bps;
        emit FeeBpsSet(bps);
    }

    function setPaused(bool p) external onlyOwner {
        paused = p;
        emit PausedSet(p);
    }

    function setFeature(bytes32 feature, bool enabled) external onlyOwner {
        _features[feature] = enabled;
        emit FeatureSet(feature, enabled);
    }

    function setOracle(address a, bool enabled) external onlyOwner {
        isOracle[a] = enabled;
        emit OracleSet(a, enabled);
    }

    function setOperator(address a, bool enabled) external onlyOwner {
        isOperator[a] = enabled;
        emit OperatorSet(a, enabled);
    }
}
