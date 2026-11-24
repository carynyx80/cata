// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Feature flag ids. Defaults: PREDICTIONS, BATTLES, FRACTIONAL off; all others on.
library Features {
    bytes32 internal constant PACKS = keccak256("PACKS");
    bytes32 internal constant MARKET = keccak256("MARKET");
    bytes32 internal constant GIFTS = keccak256("GIFTS");
    bytes32 internal constant SETS = keccak256("SETS");
    bytes32 internal constant LENDING = keccak256("LENDING");
    bytes32 internal constant LIVE_RIPS = keccak256("LIVE_RIPS");
    bytes32 internal constant PREDICTIONS = keccak256("PREDICTIONS");
    bytes32 internal constant BATTLES = keccak256("BATTLES");
    bytes32 internal constant FRACTIONAL = keccak256("FRACTIONAL");
}
