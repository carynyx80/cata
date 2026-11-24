// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ICataConfig} from "../interfaces/ICataConfig.sol";
import {ICataVault} from "../interfaces/ICataVault.sol";
import {CataPayments} from "../lib/CataPayments.sol";
import {Features} from "../lib/Features.sol";
import {CataPoints} from "./CataPoints.sol";

/// @title SetRewards — hold one vault token per catalogId in a set, claim points once per account.
/// @dev Each tokenId can count toward a given set only once ever, so moving cards between wallets
///      cannot farm the same set twice.
contract SetRewards is CataPayments {
    struct CardSet {
        string name;
        bytes32[] catalogIds;
        uint256 points;
        bool active;
    }

    ICataVault public immutable vault;
    CataPoints public immutable pointsContract;
    CardSet[] private _sets;
    mapping(uint256 => mapping(address => bool)) public claimed;
    mapping(uint256 => mapping(uint256 => bool)) public tokenUsed;

    event SetCreated(uint256 indexed setId, string name, uint256 points);
    event SetActive(uint256 indexed setId, bool active);
    event SetClaimed(uint256 indexed setId, address indexed user, uint256 points);

    error BadSet();
    error AlreadyClaimed();
    error WrongCard(uint256 index);
    error TokenAlreadyUsed(uint256 tokenId);

    constructor(ICataConfig config_, ICataVault vault_, CataPoints points_) CataPayments(config_) {
        vault = vault_;
        pointsContract = points_;
    }

    function createSet(string calldata name, bytes32[] calldata catalogIds, uint256 pts)
        external
        onlyOwner_
        returns (uint256 setId)
    {
        if (catalogIds.length == 0) revert BadSet();
        setId = _sets.length;
        _sets.push(CardSet(name, catalogIds, pts, true));
        emit SetCreated(setId, name, pts);
    }

    function setActive(uint256 setId, bool active) external onlyOwner_ {
        _sets[setId].active = active;
        emit SetActive(setId, active);
    }

    function setCount() external view returns (uint256) {
        return _sets.length;
    }

    function getSet(uint256 setId) external view returns (CardSet memory) {
        return _sets[setId];
    }

    /// @param tokenIds tokenIds[i] must be owned by caller and match catalogIds[i] of the set.
    function claimSet(uint256 setId, uint256[] calldata tokenIds) external nonReentrant whenActive(Features.SETS) {
        if (setId >= _sets.length) revert BadSet();
        CardSet storage s = _sets[setId];
        if (!s.active || tokenIds.length != s.catalogIds.length) revert BadSet();
        if (claimed[setId][msg.sender]) revert AlreadyClaimed();
        for (uint256 i; i < tokenIds.length; ++i) {
            uint256 t = tokenIds[i];
            if (vault.ownerOf(t) != msg.sender || vault.catalogIdOf(t) != s.catalogIds[i]) revert WrongCard(i);
            if (tokenUsed[setId][t]) revert TokenAlreadyUsed(t);
            tokenUsed[setId][t] = true;
        }
        claimed[setId][msg.sender] = true;
        pointsContract.award(msg.sender, s.points);
        emit SetClaimed(setId, msg.sender, s.points);
    }
}
