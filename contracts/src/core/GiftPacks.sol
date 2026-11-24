// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {ICataConfig} from "../interfaces/ICataConfig.sol";
import {CataPayments} from "../lib/CataPayments.sol";
import {Features} from "../lib/Features.sol";
import {PackMachine} from "./PackMachine.sol";

/// @title GiftPacks — send an unopened pack via a claim link.
/// @notice The gifter generates a throwaway keypair off-chain; the claim link carries its private key ("secret").
///         Only the key's address (`claimSigner`) is stored. To claim, the recipient signs
///         (this contract, chainId, giftId, recipient) with the link key. Because the recipient is bound into the
///         signature, a mempool observer cannot front-run the claim to themselves (unlike a plain hash preimage).
///         Payment happens at gift time via PackMachine.buyCredit (fee taken then); the credit is held here.
contract GiftPacks is CataPayments {
    using SafeERC20 for IERC20;

    struct Gift {
        address gifter;
        address claimSigner;
        uint256 creditId;
        bool done;
    }

    PackMachine public immutable packs;
    Gift[] private _gifts;

    event GiftCreated(uint256 indexed giftId, address indexed gifter, uint256 indexed poolId, uint256 creditId);
    event GiftClaimed(uint256 indexed giftId, address indexed recipient, uint256 requestId);
    event GiftReclaimed(uint256 indexed giftId);

    error BadSigner();
    error GiftDone();
    error NotGifter();

    constructor(ICataConfig config_, PackMachine packs_) CataPayments(config_) {
        packs = packs_;
    }

    receive() external payable {
        if (msg.sender != address(packs)) revert BadMsgValue();
    }

    function gifts(uint256 giftId) external view returns (Gift memory) {
        return _gifts[giftId];
    }

    /// @notice BNB: send >= packs.quote(poolId, 0); any excess is refunded.
    /// @param maxPriceUsd reverts if the pool's USD price is above this.
    function buyGift(uint256 poolId, address token, address claimSigner, uint256 maxPriceUsd)
        external
        payable
        nonReentrant
        whenActive(Features.GIFTS)
        returns (uint256 giftId)
    {
        if (claimSigner == address(0)) revert BadSigner();
        uint256 creditId;
        if (token == address(0)) {
            uint256 balBefore = address(this).balance - msg.value;
            creditId = packs.buyCredit{value: msg.value}(poolId, address(0), address(this), maxPriceUsd);
            uint256 refund = address(this).balance - balBefore;
            _push(address(0), msg.sender, refund);
        } else {
            if (msg.value != 0) revert BadMsgValue();
            uint256 amount = packs.quote(poolId, token);
            IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
            IERC20(token).forceApprove(address(packs), amount);
            creditId = packs.buyCredit(poolId, token, address(this), maxPriceUsd);
        }
        giftId = _gifts.length;
        _gifts.push(Gift(msg.sender, claimSigner, creditId, false));
        emit GiftCreated(giftId, msg.sender, poolId, creditId);
    }

    function claimDigest(uint256 giftId, address recipient) public view returns (bytes32) {
        return MessageHashUtils.toEthSignedMessageHash(
            keccak256(abi.encode(address(this), block.chainid, giftId, recipient))
        );
    }

    /// @notice Claim and open the gifted pack; the pulled card goes to `recipient`.
    function claim(uint256 giftId, address recipient, bytes calldata signature)
        external
        nonReentrant
        whenActive(Features.GIFTS)
        returns (uint256 requestId)
    {
        Gift storage g = _gifts[giftId];
        if (g.done) revert GiftDone();
        if (ECDSA.recover(claimDigest(giftId, recipient), signature) != g.claimSigner) revert BadSigner();
        g.done = true;
        requestId = packs.openCredit(g.creditId, recipient);
        emit GiftClaimed(giftId, recipient, requestId);
    }

    /// @notice Gifter takes back an unclaimed gift as an unopened credit they hold in PackMachine.
    function reclaim(uint256 giftId) external nonReentrant {
        Gift storage g = _gifts[giftId];
        if (g.gifter != msg.sender) revert NotGifter();
        if (g.done) revert GiftDone();
        g.done = true;
        packs.transferCredit(g.creditId, msg.sender);
        emit GiftReclaimed(giftId);
    }
}
