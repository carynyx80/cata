// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {CoreTest} from "../core/Core.t.sol";
import {MarketsBase} from "../markets/MarketsBase.sol";
import {PackMachine} from "../../src/core/PackMachine.sol";
import {FractionalGrails} from "../../src/markets/FractionalGrails.sol";
import {CardLending} from "../../src/markets/CardLending.sol";
import {IAggregatorV3} from "../../src/markets/IAggregatorV3.sol";
import {ICataConfig} from "../../src/interfaces/ICataConfig.sol";
import {ICataVault} from "../../src/interfaces/ICataVault.sol";
import {ICataPriceIndex} from "../../src/interfaces/ICataPriceIndex.sol";
import {Features} from "../../src/lib/Features.sol";

/// @notice Audit proofs for PackMachine (VRF) issues. Reuses the core fixture.
contract AuditPacksTest is CoreTest {
    function _pool() internal returns (uint256 poolId, uint256 c) {
        vm.prank(owner);
        poolId = packs.createPool("gold", 100e18);
        uint256 a = _mint(owner, "A", true);
        uint256 b = _mint(owner, "B", true);
        c = _mint(alice, "C", true);
        uint256[] memory t = new uint256[](2);
        t[0] = a;
        t[1] = b;
        vm.startPrank(owner);
        vault.setApprovalForAll(address(packs), true);
        packs.stockPool(poolId, t);
        vm.stopPrank();
        vm.startPrank(alice);
        vault.setApprovalForAll(address(packs), true);
        packs.depositToPool(poolId, c, 50e18);
        vm.stopPrank();
    }

    /// HIGH: after a VRF request is made, a depositor seeing the fulfillment (randomWord) in the mempool could
    /// deposit/withdraw to change `cards.length` and thus which card `word % length` selects.
    function test_Audit_VrfPoolCannotChangeWhileRequestPending() public {
        (uint256 poolId, uint256 c) = _pool();
        vm.startPrank(bob);
        usdt.approve(address(packs), 100e18);
        uint256 req = packs.open(poolId, address(usdt));
        vm.stopPrank();

        // attacker tries to reshape the pool before fulfillment
        uint256 d = _mint(alice, "D", true);
        vm.startPrank(alice);
        vm.expectRevert(PackMachine.OpenPending.selector);
        packs.depositToPool(poolId, d, 50e18);
        vm.expectRevert(PackMachine.OpenPending.selector);
        packs.withdrawFromPool(c);
        vm.stopPrank();

        vrf.fulfill(req, 7);
        assertEq(packs.pendingOpens(poolId), 0);
        // once settled, stocking works again
        vm.prank(alice);
        packs.depositToPool(poolId, d, 50e18);
    }

    /// MEDIUM: opening to address(0) made the VRF callback revert (ERC721 transfer to zero), leaving the card
    /// reserved forever and the user's payment lost (VRF does not retry).
    function test_Audit_OpenToZeroRecipientReverts() public {
        (uint256 poolId,) = _pool();
        vm.startPrank(bob);
        usdt.approve(address(packs), 100e18);
        uint256 creditId = packs.buyCredit(poolId, address(usdt), bob);
        vm.expectRevert(PackMachine.BadRecipient.selector);
        packs.openCredit(creditId, address(0));
        vm.stopPrank();
    }
}

/// @notice Audit proofs for market contracts.
contract AuditMarketsTest is MarketsBase {
    function setUp() public {
        _baseSetUp();
    }

    /// HIGH: operator could lower the buyout reserve after users bought shares, then buy the card out
    /// for ~nothing, leaving share holders with a dust redemption.
    function test_Audit_GrailReserveCannotBeLoweredAfterSales() public {
        FractionalGrails fg = new FractionalGrails(ICataConfig(address(cfg)), ICataVault(address(vault)));
        cfg.setFeature(Features.FRACTIONAL, true);
        uint256 card = _mintCard(operator, keccak256("grail"));
        vm.startPrank(operator);
        vault.setApprovalForAll(address(fg), true);
        uint256 id = fg.fractionalize(card, "G", "G", address(usdt), 1 ether, 2_000_000 ether);
        vm.stopPrank();

        vm.startPrank(alice);
        usdt.approve(address(fg), type(uint256).max);
        fg.buyShares(id, 500_000 ether); // alice pays ~500k USDT
        vm.stopPrank();

        vm.prank(operator);
        vm.expectRevert(FractionalGrails.BelowReserve.selector);
        fg.setReserve(id, 1); // rug attempt

        // raising is still allowed
        vm.prank(operator);
        fg.setReserve(id, 3_000_000 ether);
    }

    /// MEDIUM: price-based liquidation used a stale Cata Price Index value (borrow checked freshness,
    /// liquidation did not), so a long-stale low price could seize a healthy loan's collateral.
    function test_Audit_NoLiquidationOnStalePrice() public {
        CardLending lend = new CardLending(
            ICataConfig(address(cfg)), ICataVault(address(vault)), ICataPriceIndex(address(index)), IAggregatorV3(address(bnbFeed))
        );
        cfg.setFeature(Features.LENDING, true);
        bytes32 cid = keccak256("c");
        index.set(cid, 10_000 ether);
        uint256 card = _mintCard(alice, cid);
        vm.prank(bob); usdt.approve(address(lend), type(uint256).max);
        vm.prank(bob); lend.deposit(address(usdt), 50_000 ether);
        vm.startPrank(alice);
        vault.setApprovalForAll(address(lend), true);
        lend.borrow(card, address(usdt), 4_000 ether);
        vm.stopPrank();

        // oracle stops updating: price stays stale (and here, artificially low) but the loan is not due
        index.set(cid, 1_000 ether);
        vm.warp(block.timestamp + 4 days);
        assertFalse(lend.isLiquidatable(card));
        // fresh price confirms the drop => liquidatable
        index.set(cid, 1_000 ether);
        assertTrue(lend.isLiquidatable(card));
    }
}
