// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {ICataConfig} from "../interfaces/ICataConfig.sol";
import {ICataVault, Card} from "../interfaces/ICataVault.sol";

/// @title CataVault — graded slabs as ERC-721. physical=false marks a clearly labeled *digital* card.
contract CataVault is ERC721, ICataVault {
    ICataConfig public immutable config;
    uint256 public nextId = 1;
    string private _base;
    mapping(uint256 => Card) private _cards;

    event CardMinted(uint256 indexed tokenId, address indexed to, bytes32 indexed catalogId, uint8 grade, bool physical);
    event RedeemRequested(uint256 indexed tokenId, address indexed owner, string cert);

    error NotOperator();
    error NotOwner();
    error NotTokenOwner();
    error NotPhysical();
    error Paused();

    constructor(ICataConfig config_, string memory baseURI_) ERC721("Cata Vault Slab", "CATASLAB") {
        config = config_;
        _base = baseURI_;
    }

    function setBaseURI(string calldata b) external {
        if (msg.sender != config.owner()) revert NotOwner();
        _base = b;
    }

    function _baseURI() internal view override returns (string memory) {
        return _base;
    }

    function cardOf(uint256 tokenId) external view returns (Card memory) {
        _requireOwned(tokenId);
        return _cards[tokenId];
    }

    function catalogIdOf(uint256 tokenId) external view returns (bytes32) {
        _requireOwned(tokenId);
        return _cards[tokenId].catalogId;
    }

    function mint(address to, Card calldata card) external returns (uint256 tokenId) {
        if (!config.isOperator(msg.sender)) revert NotOperator();
        tokenId = nextId++;
        _cards[tokenId] = card;
        _safeMint(to, tokenId);
        emit CardMinted(tokenId, to, card.catalogId, card.grade, card.physical);
    }

    /// @notice Burn a physical slab to request shipment. Digital cards cannot be redeemed.
    function burnForRedeem(uint256 tokenId) external {
        if (config.paused()) revert Paused();
        address o = ownerOf(tokenId);
        if (o != msg.sender) revert NotTokenOwner();
        Card memory c = _cards[tokenId];
        if (!c.physical) revert NotPhysical();
        _burn(tokenId);
        delete _cards[tokenId];
        emit RedeemRequested(tokenId, o, c.cert);
    }

    function supportsInterface(bytes4 id) public view override(ERC721, IERC165) returns (bool) {
        return id == type(ICataVault).interfaceId || super.supportsInterface(id);
    }
}
