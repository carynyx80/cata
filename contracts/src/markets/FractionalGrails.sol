// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {CataPayments} from "../lib/CataPayments.sol";
import {ICataConfig} from "../interfaces/ICataConfig.sol";
import {ICataVault} from "../interfaces/ICataVault.sol";
import {Features} from "../lib/Features.sol";
import {GrailShares} from "./GrailShares.sol";

/// @title FractionalGrails
/// @notice Owner/operator fractionalizes a vault NFT into a fresh ERC20 (default 1,000,000 shares)
/// sold at a fixed price per whole share in BNB or USDT ($CATA when active). Share sale revenue
/// (net of the 0.2% fee) goes to the company wallet. Anyone can buy out the whole card at
/// >= reservePrice; the buyout proceeds (net of fee) are split pro-rata across all shares:
/// the portion for unsold shares goes to the company wallet immediately and holders redeem theirs.
contract FractionalGrails is CataPayments, IERC721Receiver {
    enum Status { NONE, SELLING, BOUGHT_OUT }

    struct Grail {
        uint256 tokenId;
        GrailShares shares;
        address token;        // payment token for shares and buyout
        uint256 sharePrice;   // price per 1e18 share units
        uint256 reservePrice; // minimum buyout (gross)
        Status status;
        address buyer;
        uint256 proceeds;     // remaining buyout proceeds for share holders
    }

    uint256 public constant DEFAULT_SUPPLY = 1_000_000 ether;

    ICataVault public immutable vault;
    uint256 public grailsCount;
    mapping(uint256 => Grail) public grails;

    event Fractionalized(uint256 indexed id, uint256 indexed tokenId, address shares, address token, uint256 sharePrice, uint256 reservePrice);
    event SharesBought(uint256 indexed id, address indexed buyer, uint256 shares, uint256 cost);
    event BoughtOut(uint256 indexed id, address indexed buyer, uint256 price, uint256 netProceeds);
    event Redeemed(uint256 indexed id, address indexed holder, uint256 shares, uint256 payout);
    event ReserveSet(uint256 indexed id, uint256 reservePrice);

    error NotOperator();
    error BadToken();
    error BadState();
    error BelowReserve();
    error Insufficient();

    modifier onlyOperator() {
        if (!(config.isOperator(msg.sender) || msg.sender == config.owner())) revert NotOperator();
        _;
    }

    constructor(ICataConfig cfg, ICataVault vault_) CataPayments(cfg) {
        vault = vault_;
    }

    /// @notice Caller must own `tokenId` and approve this contract.
    function fractionalize(uint256 tokenId, string calldata name_, string calldata symbol_, address token, uint256 sharePrice, uint256 reservePrice)
        external
        nonReentrant
        onlyOperator
        whenActive(Features.FRACTIONAL)
        returns (uint256 id)
    {
        if (!_isAllowedToken(token) || sharePrice == 0 || reservePrice == 0) revert BadToken();
        vault.transferFrom(msg.sender, address(this), tokenId);
        GrailShares s = new GrailShares(name_, symbol_, DEFAULT_SUPPLY);
        id = ++grailsCount;
        grails[id] = Grail({
            tokenId: tokenId,
            shares: s,
            token: token,
            sharePrice: sharePrice,
            reservePrice: reservePrice,
            status: Status.SELLING,
            buyer: address(0),
            proceeds: 0
        });
        emit Fractionalized(id, tokenId, address(s), token, sharePrice, reservePrice);
    }

    function setReserve(uint256 id, uint256 reservePrice) external onlyOperator {
        Grail storage g = grails[id];
        if (g.status != Status.SELLING || reservePrice == 0) revert BadState();
        g.reservePrice = reservePrice;
        emit ReserveSet(id, reservePrice);
    }

    function costOf(uint256 id, uint256 shareAmount) public view returns (uint256) {
        Grail storage g = grails[id];
        return (shareAmount * g.sharePrice + 1 ether - 1) / 1 ether; // round up
    }

    function buyShares(uint256 id, uint256 shareAmount) external payable nonReentrant whenActive(Features.FRACTIONAL) {
        Grail storage g = grails[id];
        if (g.status != Status.SELLING || shareAmount == 0) revert BadState();
        if (!_isAllowedToken(g.token)) revert BadToken();
        if (g.token != address(0) && msg.value != 0) revert BadToken();
        if (g.shares.balanceOf(address(this)) < shareAmount) revert Insufficient();
        uint256 cost = costOf(id, shareAmount);
        _pull(g.token, msg.sender, cost);
        uint256 net = _takeFee(g.token, cost);
        _push(g.token, config.companyWallet(), net);
        g.shares.transfer(msg.sender, shareAmount);
        emit SharesBought(id, msg.sender, shareAmount, cost);
    }

    /// @notice Buy the whole card at >= reservePrice. Allowed while the feature is on or off
    /// (so share holders are never stuck) but the contract must not be paused.
    function buyout(uint256 id, uint256 price) external payable nonReentrant {
        if (config.paused()) revert BadState();
        Grail storage g = grails[id];
        if (g.status != Status.SELLING) revert BadState();
        if (price < g.reservePrice) revert BelowReserve();
        if (g.token != address(0) && msg.value != 0) revert BadToken();
        _pull(g.token, msg.sender, price);
        uint256 net = _takeFee(g.token, price);

        g.status = Status.BOUGHT_OUT;
        g.buyer = msg.sender;

        // unsold shares belong to the company: settle that slice now and burn them
        uint256 supply = g.shares.totalSupply();
        uint256 unsold = g.shares.balanceOf(address(this));
        uint256 companyPart = (net * unsold) / supply;
        g.proceeds = net - companyPart;
        if (unsold > 0) g.shares.burnFrom(address(this), unsold);
        if (companyPart > 0) _push(g.token, config.companyWallet(), companyPart);

        vault.safeTransferFrom(address(this), msg.sender, g.tokenId);
        emit BoughtOut(id, msg.sender, price, net);
    }

    /// @notice Burn shares for a pro-rata slice of the buyout proceeds (fee already taken at buyout).
    function redeem(uint256 id, uint256 shareAmount) external nonReentrant {
        Grail storage g = grails[id];
        if (g.status != Status.BOUGHT_OUT || shareAmount == 0) revert BadState();
        uint256 supply = g.shares.totalSupply();
        uint256 payout = (g.proceeds * shareAmount) / supply;
        g.shares.burnFrom(msg.sender, shareAmount);
        g.proceeds -= payout;
        _push(g.token, msg.sender, payout);
        emit Redeemed(id, msg.sender, shareAmount, payout);
    }

    function onERC721Received(address, address, uint256, bytes calldata) external view returns (bytes4) {
        if (msg.sender != address(vault)) revert BadToken();
        return IERC721Receiver.onERC721Received.selector;
    }
}
