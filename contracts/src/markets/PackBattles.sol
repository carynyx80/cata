// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {CataPayments} from "../lib/CataPayments.sol";
import {ICataConfig} from "../interfaces/ICataConfig.sol";
import {Features} from "../lib/Features.sol";

/// @title PackBattles
/// @notice Two players pay the same entry (pack price) in the same token. After both packs are
/// ripped off-chain, an oracle reports the USD value of each player's pull and settles: the higher
/// value takes the pot minus the 0.2% fee. On an exact tie the pot (minus fee) is split equally;
/// no randomness source is involved, so nobody (owner included) can pick a tie winner.
///
/// TRUST ASSUMPTION: the pulled values passed to `settle` are reported by a Cata oracle/operator
/// (config.isOracle / isOperator) and are NOT verified on-chain. Players trust that role to report
/// the real pulls; a malicious or compromised oracle can choose the winner of any FULL battle
/// (but cannot take the pot itself: it is only ever credited to playerA and/or playerB, or
/// refunded). If the oracle does not settle within SETTLE_TIMEOUT, either party can trigger a
/// full refund to both players.
///
/// Payouts are pull-based: amounts are credited to `owed[token][player]` and claimed with
/// `withdraw(token)`, so a player whose address rejects BNB cannot block the other player.
contract PackBattles is CataPayments {
    enum Status { NONE, OPEN, FULL, SETTLED, CANCELLED }

    struct Battle {
        address playerA;
        address playerB;
        address token;
        uint256 entry;
        uint64 fullAt;
        Status status;
        uint256 valueA;
        uint256 valueB;
        address winner; // address(0) on a tie
    }

    uint256 public constant SETTLE_TIMEOUT = 7 days;

    uint256 public battlesCount;
    mapping(uint256 => Battle) public battles;
    /// @notice token => player => amount claimable via withdraw(token)
    mapping(address => mapping(address => uint256)) public owed;

    event BattleCreated(uint256 indexed id, address indexed playerA, address token, uint256 entry);
    event BattleJoined(uint256 indexed id, address indexed playerB);
    /// @dev winner == address(0) and payout == the per-player share on a tie
    event BattleSettled(uint256 indexed id, address indexed winner, uint256 valueA, uint256 valueB, uint256 payout);
    event BattleCancelled(uint256 indexed id);
    event Credited(address indexed token, address indexed to, uint256 amount);
    event Withdrawn(address indexed token, address indexed to, uint256 amount);

    error BadToken();
    error BadState();
    error NotAuthorized();
    error NothingOwed();

    constructor(ICataConfig cfg) CataPayments(cfg) {}

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

    /// @notice Creator cancels an unjoined battle (refund credited, no fee as no transaction completed).
    function cancelOpen(uint256 id) external nonReentrant {
        Battle storage b = battles[id];
        if (b.status != Status.OPEN || msg.sender != b.playerA) revert BadState();
        b.status = Status.CANCELLED;
        _credit(b.token, b.playerA, b.entry);
        emit BattleCancelled(id);
    }

    /// @notice Oracle reports both pulled values (USD 18-dec) and settles. See TRUST ASSUMPTION.
    function settle(uint256 id, uint256 valueA, uint256 valueB) external nonReentrant {
        if (!(config.isOracle(msg.sender) || config.isOperator(msg.sender))) revert NotAuthorized();
        Battle storage b = battles[id];
        if (b.status != Status.FULL) revert BadState();
        b.valueA = valueA;
        b.valueB = valueB;
        b.status = Status.SETTLED;
        uint256 net = _takeFee(b.token, b.entry * 2);
        if (valueA == valueB) {
            uint256 half = net / 2;
            _credit(b.token, b.playerA, half);
            _credit(b.token, b.playerB, net - half);
            emit BattleSettled(id, address(0), valueA, valueB, half);
            return;
        }
        address winner = valueA > valueB ? b.playerA : b.playerB;
        b.winner = winner;
        _credit(b.token, winner, net);
        emit BattleSettled(id, winner, valueA, valueB, net);
    }

    /// @notice If not settled in time, both players are refunded in full (battle never completed).
    function refundExpired(uint256 id) external nonReentrant {
        Battle storage b = battles[id];
        if (b.status != Status.FULL || block.timestamp < b.fullAt + SETTLE_TIMEOUT) revert BadState();
        b.status = Status.CANCELLED;
        _credit(b.token, b.playerA, b.entry);
        _credit(b.token, b.playerB, b.entry);
        emit BattleCancelled(id);
    }

    /// @notice Claim everything credited to the caller in `token`.
    function withdraw(address token) external nonReentrant {
        uint256 amt = owed[token][msg.sender];
        if (amt == 0) revert NothingOwed();
        owed[token][msg.sender] = 0;
        _push(token, msg.sender, amt);
        emit Withdrawn(token, msg.sender, amt);
    }

    function _credit(address token, address to, uint256 amount) internal {
        owed[token][to] += amount;
        emit Credited(token, to, amount);
    }
}
