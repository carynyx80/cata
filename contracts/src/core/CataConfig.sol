// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ICataConfig} from "../interfaces/ICataConfig.sol";
import {Features} from "../lib/Features.sol";

/// @title CataConfig — global settings, roles, feature flags and the one-time $CATA activation lock.
/// @dev Money rules that are NOT owner-adjustable (SPEC: "0.2% fee, 100% to buyback"):
///      - the fee is a constant 20 bps (no setter);
///      - the treasury (CataTreasury, which can only buy back + burn) is set once and then locked forever.
contract CataConfig is ICataConfig, Ownable {
    uint16 public constant FEE_BPS = 20;

    address public treasury; // set once (constructor or setTreasury), then locked
    bool public treasuryLocked;
    address public companyWallet;
    address public immutable usdt;
    address public cataToken; // address(0) until activateCata; then locked forever
    bool public paused;

    mapping(bytes32 => bool) private _features;
    mapping(address => bool) public isOracle;
    mapping(address => bool) public isOperator;

    event CataActivated(address indexed token);
    event TreasurySet(address treasury);
    event CompanyWalletSet(address wallet);
    event PausedSet(bool paused);
    event FeatureSet(bytes32 indexed feature, bool enabled);
    event OracleSet(address indexed account, bool enabled);
    event OperatorSet(address indexed account, bool enabled);

    error ZeroAddress();
    error AlreadyActivated();
    error TreasuryLocked();
    error NotAContract();
    error NotAToken();

    constructor(address owner_, address companyWallet_, address usdt_, address treasury_) Ownable(owner_) {
        if (companyWallet_ == address(0) || usdt_ == address(0)) revert ZeroAddress();
        companyWallet = companyWallet_;
        usdt = usdt_;
        // treasury_ may be address(0) when the treasury contract is deployed after this config (it needs the
        // config address); it must then be set exactly once with setTreasury. Fee-taking reverts until then.
        if (treasury_ != address(0)) {
            treasury = treasury_;
            treasuryLocked = true;
            emit TreasurySet(treasury_);
        }
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

    /// @notice Fixed protocol fee: 20 bps. Not adjustable.
    function feeBps() external pure returns (uint16) {
        return FEE_BPS;
    }

    /// @notice One-time, irreversible activation of $CATA. `token` must be a deployed ERC-20 contract.
    function activateCata(address token) external onlyOwner {
        if (token == address(0)) revert ZeroAddress();
        if (cataToken != address(0)) revert AlreadyActivated();
        if (token.code.length == 0) revert NotAToken();
        (bool okD, bytes memory d) = token.staticcall(abi.encodeWithSignature("decimals()"));
        (bool okS, bytes memory t) = token.staticcall(abi.encodeWithSignature("totalSupply()"));
        if (!okD || d.length < 32 || !okS || t.length < 32) revert NotAToken();
        cataToken = token;
        emit CataActivated(token);
    }

    /// @notice One-time treasury wiring (only if not given at construction). Locked forever afterwards.
    function setTreasury(address t) external onlyOwner {
        if (treasuryLocked) revert TreasuryLocked();
        if (t == address(0)) revert ZeroAddress();
        if (t.code.length == 0) revert NotAContract();
        treasury = t;
        treasuryLocked = true;
        emit TreasurySet(t);
    }

    function setCompanyWallet(address w) external onlyOwner {
        if (w == address(0)) revert ZeroAddress();
        companyWallet = w;
        emit CompanyWalletSet(w);
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
