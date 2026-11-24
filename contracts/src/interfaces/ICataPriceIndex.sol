// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ICataPriceIndex {
    function priceUsd(bytes32 catalogId) external view returns (uint256 price18, uint64 updatedAt);
    function setPrices(bytes32[] calldata ids, uint256[] calldata prices18) external; // oracle only
}
