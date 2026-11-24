// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice VRF-style randomness source for pack battles.
interface IBattleRandomness {
    /// @notice Returns a request id; the provider later calls `IBattleRandomnessConsumer.fulfilRandom`.
    function requestRandom(uint256 battleId) external returns (uint256 requestId);
}

interface IBattleRandomnessConsumer {
    function fulfilRandom(uint256 requestId, uint256 randomWord) external;
}
