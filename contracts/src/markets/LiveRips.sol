// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {CataPayments} from "../lib/CataPayments.sol";
import {ICataConfig} from "../interfaces/ICataConfig.sol";
import {ICataVault} from "../interfaces/ICataVault.sol";
import {Features} from "../lib/Features.sol";

/// @title LiveRips
/// @notice Operator opens a rip session for a sealed product, users buy spots, and after the
/// stream the operator assigns pulled vault NFTs (pre-minted to / held by this contract) to spot
/// holders. Spot revenue (minus the 0.2% fee) is escrowed in this contract and released to the
/// company wallet only once every sold spot has been assigned a card (each spot exactly once,
/// each vault token at most once, ever). `markRipped` just closes sales; the release happens
/// automatically when the last sold spot is assigned. If the session is cancelled (before it is
/// complete), holders of spots that did not get a card are refunded from escrow; the escrow for
/// spots that did get a card goes to the company wallet.
contract LiveRips is CataPayments, IERC721Receiver {
    enum Status { NONE, OPEN, RIPPED, CANCELLED, COMPLETE }

    struct Session {
        string product;     // sealed product description
        address token;
        uint256 spotPrice;
        uint32 spots;
        uint32 sold;
        Status status;
        uint256 escrowNet;  // net revenue held until every sold spot is assigned
        uint32 assigned;    // number of sold spots that received a card
        uint256 assignedNet; // escrow attributable to assigned spots
    }

    ICataVault public immutable vault;
    uint256 public sessionsCount;
    mapping(uint256 => Session) public sessions;
    mapping(uint256 => mapping(uint32 => address)) public spotOwner; // session => spot index => buyer
    mapping(uint256 => mapping(uint32 => uint256)) public spotPaidNet;
    /// @notice session => spot => vault tokenId assigned (0 = unassigned; vault ids start at 1)
    mapping(uint256 => mapping(uint32 => uint256)) public spotCard;
    /// @notice vault tokenId => already assigned to some spot (each card can be assigned once)
    mapping(uint256 => bool) public cardAssigned;

    event SessionCreated(uint256 indexed id, string product, address token, uint256 spotPrice, uint32 spots);
    event SpotBought(uint256 indexed id, uint32 indexed spot, address indexed buyer, uint256 gross, uint256 net);
    event SessionRipped(uint256 indexed id);
    event EscrowReleased(uint256 indexed id, uint256 revenue);
    event CardAssigned(uint256 indexed id, uint32 indexed spot, address indexed to, uint256 tokenId);
    event SessionCancelled(uint256 indexed id);
    event SpotRefunded(uint256 indexed id, uint32 indexed spot, address to, uint256 amount);

    error NotOperator();
    error BadToken();
    error BadState();
    error SoldOut();
    error BadSpot();
    error AlreadyAssigned();

    modifier onlyOperator() {
        if (!(config.isOperator(msg.sender) || msg.sender == config.owner())) revert NotOperator();
        _;
    }

    constructor(ICataConfig cfg, ICataVault vault_) CataPayments(cfg) {
        vault = vault_;
    }

    function createSession(string calldata product, uint32 spots, uint256 spotPrice, address token)
        external
        onlyOperator
        whenActive(Features.LIVE_RIPS)
        returns (uint256 id)
    {
        if (!_isAllowedToken(token)) revert BadToken();
        if (spots == 0 || spotPrice == 0) revert BadState();
        id = ++sessionsCount;
        Session storage s = sessions[id];
        s.product = product;
        s.token = token;
        s.spotPrice = spotPrice;
        s.spots = spots;
        s.status = Status.OPEN;
        emit SessionCreated(id, product, token, spotPrice, spots);
    }

    function buySpots(uint256 id, uint32 count) external payable nonReentrant whenActive(Features.LIVE_RIPS) {
        Session storage s = sessions[id];
        if (s.status != Status.OPEN) revert BadState();
        if (count == 0 || s.sold + count > s.spots) revert SoldOut();
        if (s.token != address(0) && msg.value != 0) revert BadToken();
        uint256 gross = s.spotPrice * count;
        _pull(s.token, msg.sender, gross);
        uint256 net = _takeFee(s.token, gross);
        s.escrowNet += net;
        uint256 perSpot = net / count;
        for (uint32 i = 0; i < count; i++) {
            uint32 spot = s.sold++;
            spotOwner[id][spot] = msg.sender;
            spotPaidNet[id][spot] = (i == count - 1) ? net - perSpot * (count - 1) : perSpot;
            emit SpotBought(id, spot, msg.sender, s.spotPrice, spotPaidNet[id][spot]);
        }
    }

    /// @notice Close sales. Escrow stays put until every sold spot has been assigned a card.
    function markRipped(uint256 id) external nonReentrant onlyOperator {
        Session storage s = sessions[id];
        if (s.status != Status.OPEN) revert BadState();
        s.status = Status.RIPPED;
        emit SessionRipped(id);
        if (s.sold == 0) _complete(id, s);
    }

    /// @notice Assign pulled cards (vault NFTs held by this contract) to spot holders. Each sold
    /// spot gets exactly one card; each vault token can be assigned only once. When the last sold
    /// spot is assigned, the escrowed revenue is released to the company wallet.
    function assignCards(uint256 id, uint32[] calldata spots, uint256[] calldata tokenIds) external nonReentrant onlyOperator {
        Session storage s = sessions[id];
        if (s.status != Status.RIPPED) revert BadState();
        if (spots.length != tokenIds.length) revert BadSpot();
        for (uint256 i = 0; i < spots.length; i++) {
            uint32 spot = spots[i];
            uint256 tokenId = tokenIds[i];
            if (spot >= s.sold) revert BadSpot();
            if (spotCard[id][spot] != 0 || cardAssigned[tokenId] || tokenId == 0) revert AlreadyAssigned();
            spotCard[id][spot] = tokenId;
            cardAssigned[tokenId] = true;
            s.assigned += 1;
            s.assignedNet += spotPaidNet[id][spot];
            address to = spotOwner[id][spot];
            // transferFrom (not safe): a contract buyer that cannot receive ERC721 must not
            // block the session from completing
            vault.transferFrom(address(this), to, tokenId);
            emit CardAssigned(id, spot, to, tokenId);
        }
        if (s.assigned == s.sold) _complete(id, s);
    }

    function _complete(uint256 id, Session storage s) internal {
        s.status = Status.COMPLETE;
        uint256 rev = s.escrowNet;
        s.escrowNet = 0;
        _push(s.token, config.companyWallet(), rev);
        emit EscrowReleased(id, rev);
    }

    /// @notice Cancel an open or ripped (not yet complete) session. Holders of unassigned spots
    /// then call refundSpot (net of the fee already taken); escrow for spots that already got a
    /// card is released to the company wallet.
    function cancelSession(uint256 id) external nonReentrant onlyOperator {
        Session storage s = sessions[id];
        if (s.status != Status.OPEN && s.status != Status.RIPPED) revert BadState();
        s.status = Status.CANCELLED;
        uint256 rev = s.assignedNet;
        if (rev > 0) {
            s.assignedNet = 0;
            s.escrowNet -= rev;
            _push(s.token, config.companyWallet(), rev);
            emit EscrowReleased(id, rev);
        }
        emit SessionCancelled(id);
    }

    function refundSpot(uint256 id, uint32 spot) external nonReentrant {
        Session storage s = sessions[id];
        if (s.status != Status.CANCELLED) revert BadState();
        address to = spotOwner[id][spot];
        uint256 amt = spotPaidNet[id][spot];
        if (to == address(0) || amt == 0 || spotCard[id][spot] != 0) revert BadSpot();
        spotPaidNet[id][spot] = 0;
        s.escrowNet -= amt;
        _push(s.token, to, amt);
        emit SpotRefunded(id, spot, to, amt);
    }

    function onERC721Received(address, address, uint256, bytes calldata) external view returns (bytes4) {
        if (msg.sender != address(vault)) revert BadToken();
        return IERC721Receiver.onERC721Received.selector;
    }
}
