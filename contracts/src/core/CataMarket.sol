// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {ICataConfig} from "../interfaces/ICataConfig.sol";
import {CataPayments} from "../lib/CataPayments.sol";
import {Features} from "../lib/Features.sol";

/// @title CataMarket — escrowed fixed-price listings of vault slabs. 20 bps fee to treasury, rest to seller.
contract CataMarket is CataPayments {
    struct Listing {
        address seller;
        uint256 tokenId;
        address token; // address(0) = BNB
        uint256 price;
        bool active;
    }

    IERC721 public immutable vault;
    uint256 public nextListingId = 1;
    mapping(uint256 => Listing) public listings;

    event Listed(uint256 indexed listingId, address indexed seller, uint256 indexed tokenId, address token, uint256 price);
    event Cancelled(uint256 indexed listingId);
    event Sold(uint256 indexed listingId, address indexed buyer, uint256 price, uint256 fee);

    error BadPrice();
    error NotSeller();
    error NotActive();

    constructor(ICataConfig config_, IERC721 vault_) CataPayments(config_) {
        vault = vault_;
    }

    function list(uint256 tokenId, address token, uint256 price)
        external
        nonReentrant
        whenActive(Features.MARKET)
        returns (uint256 id)
    {
        if (!_isAllowedToken(token)) revert TokenNotAllowed(token);
        if (price == 0) revert BadPrice();
        vault.transferFrom(msg.sender, address(this), tokenId);
        id = nextListingId++;
        listings[id] = Listing(msg.sender, tokenId, token, price, true);
        emit Listed(id, msg.sender, tokenId, token, price);
    }

    function cancel(uint256 id) external nonReentrant {
        Listing storage l = listings[id];
        if (!l.active) revert NotActive();
        if (l.seller != msg.sender) revert NotSeller();
        l.active = false;
        vault.transferFrom(address(this), msg.sender, l.tokenId);
        emit Cancelled(id);
    }

    function buy(uint256 id) external payable nonReentrant whenActive(Features.MARKET) {
        Listing storage l = listings[id];
        if (!l.active) revert NotActive();
        if (!_isAllowedToken(l.token)) revert TokenNotAllowed(l.token);
        l.active = false;
        _pull(l.token, msg.sender, l.price);
        uint256 net = _takeFee(l.token, l.price);
        _push(l.token, l.seller, net);
        vault.transferFrom(address(this), msg.sender, l.tokenId);
        emit Sold(id, msg.sender, l.price, l.price - net);
    }
}
