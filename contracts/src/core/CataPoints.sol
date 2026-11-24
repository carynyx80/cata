// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ICataConfig} from "../interfaces/ICataConfig.sol";
import {CataPayments} from "../lib/CataPayments.sol";

/// @title CataPoints — non-transferable points (pack opens, set completion).
/// @dev After $CATA activation, users may convert points to $CATA at `cataPerPoint` (owner-set, 18 dec),
///      paid from this contract's $CATA balance (funded by CataTreasury rewards route or the owner).
///      Only owner-managed `isAwarder` contracts (PackMachine, SetRewards) may award points; this is separate from
///      the global operator role so point-awarding contracts get no minting / stocking / resolving power.
///      $CATA held here can only be paid to point holders or burned/returned to the treasury.
contract CataPoints is CataPayments {
    address public constant DEAD = 0x000000000000000000000000000000000000dEaD;

    mapping(address => uint256) public points;
    uint256 public totalPoints;
    uint256 public cataPerPoint; // CATA wei per 1 point; 0 = conversion closed
    mapping(address => bool) public isAwarder;

    event PointsAwarded(address indexed user, uint256 amount, address indexed by);
    event PointsConverted(address indexed user, uint256 points, uint256 cataOut);
    event RateSet(uint256 cataPerPoint);
    event AwarderSet(address indexed account, bool enabled);

    error NotAwarder();
    error BadDestination();
    error CataNotActive();
    error ConversionClosed();
    error InsufficientPoints();

    constructor(ICataConfig config_) CataPayments(config_) {}

    function award(address user, uint256 amount) external {
        if (!isAwarder[msg.sender]) revert NotAwarder();
        points[user] += amount;
        totalPoints += amount;
        emit PointsAwarded(user, amount, msg.sender);
    }

    function setAwarder(address a, bool enabled) external onlyOwner_ {
        isAwarder[a] = enabled;
        emit AwarderSet(a, enabled);
    }

    function setRate(uint256 rate) external onlyOwner_ {
        cataPerPoint = rate;
        emit RateSet(rate);
    }

    function convert(uint256 amount) external nonReentrant returns (uint256 net) {
        if (config.paused()) revert Paused();
        if (!config.cataActive()) revert CataNotActive();
        if (cataPerPoint == 0) revert ConversionClosed();
        if (points[msg.sender] < amount) revert InsufficientPoints();
        points[msg.sender] -= amount;
        totalPoints -= amount;
        address cata = config.cataToken();
        net = _takeFee(cata, amount * cataPerPoint);
        _push(cata, msg.sender, net);
        emit PointsConverted(msg.sender, amount, net);
    }

    /// @notice Owner may retire excess CATA from the reward pool: only to DEAD (burn) or back to the treasury
    ///         (which can only burn it), so the rewards route can never be used to redirect fees.
    function withdrawCata(address to, uint256 amount) external onlyOwner_ {
        if (to != DEAD && to != config.treasury()) revert BadDestination();
        _push(config.cataToken(), to, amount);
    }
}
