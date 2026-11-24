// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ICataConfig} from "../interfaces/ICataConfig.sol";
import {ICataPriceIndex} from "../interfaces/ICataPriceIndex.sol";

/// @title CataPriceIndex — on-chain USD (18 dec) prices per catalog id, pushed by oracle role.
/// @dev History is reconstructable from PriceUpdated events (indexed by catalogId).
contract CataPriceIndex is ICataPriceIndex {
    struct Price {
        uint256 price18;
        uint64 updatedAt;
    }

    ICataConfig public immutable config;
    mapping(bytes32 => Price) private _prices;

    event PriceUpdated(bytes32 indexed catalogId, uint256 price18, uint64 updatedAt);

    error NotOracle();
    error LengthMismatch();

    constructor(ICataConfig config_) {
        config = config_;
    }

    function priceUsd(bytes32 catalogId) external view returns (uint256 price18, uint64 updatedAt) {
        Price memory p = _prices[catalogId];
        return (p.price18, p.updatedAt);
    }

    function setPrices(bytes32[] calldata ids, uint256[] calldata prices18) external {
        if (!config.isOracle(msg.sender)) revert NotOracle();
        if (ids.length != prices18.length) revert LengthMismatch();
        uint64 nowTs = uint64(block.timestamp);
        for (uint256 i; i < ids.length; ++i) {
            _prices[ids[i]] = Price(prices18[i], nowTs);
            emit PriceUpdated(ids[i], prices18[i], nowTs);
        }
    }
}
