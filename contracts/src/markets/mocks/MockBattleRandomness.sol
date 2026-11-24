// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IBattleRandomness, IBattleRandomnessConsumer} from "../IBattleRandomness.sol";

/// @notice Test-only randomness provider: fulfil manually.
contract MockBattleRandomness is IBattleRandomness {
    uint256 public nextId = 1;
    mapping(uint256 => address) public consumerOf;

    function requestRandom(uint256) external returns (uint256 id) {
        id = nextId++;
        consumerOf[id] = msg.sender;
    }

    function fulfil(uint256 id, uint256 word) external {
        IBattleRandomnessConsumer(consumerOf[id]).fulfilRandom(id, word);
    }
}
