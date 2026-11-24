// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {CataPayments} from "../lib/CataPayments.sol";
import {ICataConfig} from "../interfaces/ICataConfig.sol";
import {Features} from "../lib/Features.sol";
import {IBattleRandomness, IBattleRandomnessConsumer} from "./IBattleRandomness.sol";

/// @title PackBattles
/// @notice Two players pay the same entry (pack price) in the same token. After both packs are
/// ripped off-chain, an oracle reports the USD value of each player's pull and settles: the higher
/// value takes the pot minus the 0.2% fee. Ties are broken by a VRF-style random word.
///
/// TRUST ASSUMPTION: pulled values are reported by a Cata oracle/operator (config.isOracle /
/// isOperator). Players trust the oracle to report the real pulls. The optional randomness
/// provider is only used for tie-breaks. Either player can reclaim their stake if the battle is
/// not settled within SETTLE_TIMEOUT.
contract PackBattles is CataPayments, IBattleRandomnessConsumer {
    enum Status { NONE, OPEN, FULL, TIEBREAK, SETTLED, CANCELLED }

    struct Battle {
        address playerA;
        address playerB;
        address token;
        uint256 entry;
        uint64 fullAt;
        Status status;
        uint256 valueA;
        uint256 valueB;
        address winner;
    }

    uint256 public constant SETTLE_TIMEOUT = 7 days;

    IBattleRandomness public randomness;
    uint256 public battlesCount;
    mapping(uint256 => Battle) public battles;
    mapping(uint256 => uint256) public requestToBattle;

    event RandomnessSet(address provider);
    event BattleCreated(uint256 indexed id, address indexed playerA, address token, uint256 entry);
    event BattleJoined(uint256 indexed id, address indexed playerB);
    event BattleSettled(uint256 indexed id, address indexed winner, uint256 valueA, uint256 valueB, uint256 payout);
    event BattleCancelled(uint256 indexed id);

    error BadToken();
    error BadState();
    error NotAuthorized();

    constructor(ICataConfig cfg, IBattleRandomness rng) CataPayments(cfg) {
        randomness = rng;
    }

    function setRandomness(IBattleRandomness rng) external onlyOwner_ {
        randomness = rng;
        emit RandomnessSet(address(rng));
    }

    function createBattle(address token, uint256 entry) external payable nonReentrant whenActive(Features.BATTLES) returns (uint256 id) {
        if (!_isAllowedToken(token) || entry == 0) revert BadToken();
        if (token != address(0) && msg.value != 0) revert BadToken();
        _pull(token, msg.sender, entry);
        id = ++battlesCount;
        Battle storage b = battles[id];
        b.playerA = msg.sender;
        b.token = token;
        b.entry = entry;
        b.status = Status.OPEN;
        emit BattleCreated(id, msg.sender, token, entry);
    }

    function joinBattle(uint256 id) external payable nonReentrant whenActive(Features.BATTLES) {
        Battle storage b = battles[id];
        if (b.status != Status.OPEN || msg.sender == b.playerA) revert BadState();
        if (b.token != address(0) && msg.value != 0) revert BadToken();
        _pull(b.token, msg.sender, b.entry);
        b.playerB = msg.sender;
        b.status = Status.FULL;
        b.fullAt = uint64(block.timestamp);
        emit BattleJoined(id, msg.sender);
    }

    /// @notice Creator cancels an unjoined battle (refund, no fee as no transaction completed).
    function cancelOpen(uint256 id) external nonReentrant {
        Battle storage b = battles[id];
        if (b.status != Status.OPEN || msg.sender != b.playerA) revert BadState();
        b.status = Status.CANCELLED;
        _push(b.token, b.playerA, b.entry);
        emit BattleCancelled(id);
    }

    /// @notice Oracle reports both pulled values (USD 18-dec) and settles.
    function settle(uint256 id, uint256 valueA, uint256 valueB) external nonReentrant {
        if (!(config.isOracle(msg.sender) || config.isOperator(msg.sender))) revert NotAuthorized();
        Battle storage b = battles[id];
        if (b.status != Status.FULL) revert BadState();
        b.valueA = valueA;
        b.valueB = valueB;
        if (valueA == valueB && address(randomness) != address(0)) {
            b.status = Status.TIEBREAK;
            uint256 req = randomness.requestRandom(id);
            requestToBattle[req] = id;
            return;
        }
        // tie without randomness provider: playerA (creator) wins
        _payout(id, b, valueB > valueA ? b.playerB : b.playerA);
    }

    function fulfilRandom(uint256 requestId, uint256 randomWord) external nonReentrant {
        if (msg.sender != address(randomness)) revert NotAuthorized();
        uint256 id = requestToBattle[requestId];
        Battle storage b = battles[id];
        if (b.status != Status.TIEBREAK) revert BadState();
        delete requestToBattle[requestId];
        _payout(id, b, randomWord % 2 == 0 ? b.playerA : b.playerB);
    }

    /// @notice If not settled in time, both players are refunded in full (battle never completed).
    function refundExpired(uint256 id) external nonReentrant {
        Battle storage b = battles[id];
        if ((b.status != Status.FULL && b.status != Status.TIEBREAK) || block.timestamp < b.fullAt + SETTLE_TIMEOUT) revert BadState();
        b.status = Status.CANCELLED;
        _push(b.token, b.playerA, b.entry);
        _push(b.token, b.playerB, b.entry);
        emit BattleCancelled(id);
    }

    function _payout(uint256 id, Battle storage b, address winner) internal {
        b.status = Status.SETTLED;
        b.winner = winner;
        uint256 net = _takeFee(b.token, b.entry * 2);
        _push(b.token, winner, net);
        emit BattleSettled(id, winner, b.valueA, b.valueB, net);
    }
}
