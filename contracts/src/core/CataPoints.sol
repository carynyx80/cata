// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ICataConfig} from "../interfaces/ICataConfig.sol";
import {CataPayments} from "../lib/CataPayments.sol";

/// @title CataPoints — non-transferable points (pack opens, set completion).
/// @dev After $CATA activation, users may convert points to $CATA at `cataPerPoint` (owner-set, 18 dec),
///      paid from this contract's $CATA balance (funded by CataTreasury rewards route or the owner).
contract CataPoints is CataPayments {
    mapping(address => uint256) public points;
    uint256 public totalPoints;
    uint256 public cataPerPoint; // CATA wei per 1 point; 0 = conversion closed

    event PointsAwarded(address indexed user, uint256 amount, address indexed by);
    event PointsConverted(address indexed user, uint256 points, uint256 cataOut);
    event RateSet(uint256 cataPerPoint);

    error NotOperator();
    error CataNotActive();
    error ConversionClosed();
    error InsufficientPoints();

    constructor(ICataConfig config_) CataPayments(config_) {}

    function award(address user, uint256 amount) external {
        if (!config.isOperator(msg.sender)) revert NotOperator();
        points[user] += amount;
        totalPoints += amount;
        emit PointsAwarded(user, amount, msg.sender);
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

    /// @notice Owner may recover CATA from the reward pool (e.g. to migrate it).
    function withdrawCata(address to, uint256 amount) external onlyOwner_ {
        _push(config.cataToken(), to, amount);
    }
}
