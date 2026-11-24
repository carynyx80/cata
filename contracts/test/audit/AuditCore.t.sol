// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {CoreTest} from "../core/Core.t.sol";
import {CataConfig} from "../../src/core/CataConfig.sol";
import {CataTreasury} from "../../src/core/CataTreasury.sol";
import {CataPoints} from "../../src/core/CataPoints.sol";
import {PackMachine} from "../../src/core/PackMachine.sol";
import {ICataConfig} from "../../src/interfaces/ICataConfig.sol";
import {CataPayments} from "../../src/lib/CataPayments.sol";

/// @notice Proofs for the core security-review fixes. Reuses the core fixture.
contract AuditCoreTest is CoreTest {
    function _pool() internal returns (uint256 poolId, uint256 a, uint256 b, uint256 c) {
        vm.prank(owner);
        poolId = packs.createPool("gold", 100e18);
        a = _mint(owner, "A", true);
        b = _mint(owner, "B", true);
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

    function _openBob(uint256 poolId) internal returns (uint256 req) {
        vm.startPrank(bob);
        usdt.approve(address(packs), 100e18);
        req = packs.open(poolId, address(usdt), 100e18);
        vm.stopPrank();
    }

    // ------------------------------------------------------------------ 1. fee redirection

    function test_AuditCore_FeeIsFixedNoSetter() public {
        assertEq(cfg.feeBps(), 20);
        vm.prank(owner);
        (bool ok,) = address(cfg).call(abi.encodeWithSignature("setFeeBps(uint16)", uint16(100)));
        assertFalse(ok);
        assertEq(cfg.feeBps(), 20);
    }

    function test_AuditCore_TreasuryLockedForever() public {
        assertTrue(cfg.treasuryLocked());
        vm.prank(owner);
        vm.expectRevert(CataConfig.TreasuryLocked.selector);
        cfg.setTreasury(address(packs));
        assertEq(cfg.treasury(), address(treasury));

        // constructor-provided treasury is locked immediately
        CataConfig c2 = new CataConfig(owner, owner, address(usdt), address(treasury));
        assertTrue(c2.treasuryLocked());
        vm.prank(owner);
        vm.expectRevert(CataConfig.TreasuryLocked.selector);
        c2.setTreasury(address(packs));

        // one-time setter rejects EOAs; fees cannot be taken until a treasury is set
        CataConfig c3 = new CataConfig(owner, owner, address(usdt), address(0));
        assertEq(c3.treasury(), address(0));
        vm.prank(owner);
        vm.expectRevert(CataConfig.NotAContract.selector);
        c3.setTreasury(alice);
    }

    function test_AuditCore_RewardsRouteOnlyCataPointsLocked() public {
        assertEq(treasury.rewardsBps(), 0);
        assertEq(treasury.rewardsVault(), address(0));
        vm.startPrank(owner);
        // EOA rejected
        vm.expectRevert(CataTreasury.BadConfig.selector);
        treasury.setRewardsRoute(alice, 1000);
        // a contract that is not a CataPoints of this config is rejected
        vm.expectRevert(CataTreasury.BadConfig.selector);
        treasury.setRewardsRoute(address(usdt), 1000);
        CataPoints foreign = new CataPoints(ICataConfig(address(new CataConfig(owner, owner, address(usdt), address(treasury)))));
        vm.expectRevert(CataTreasury.BadConfig.selector);
        treasury.setRewardsRoute(address(foreign), 1000);
        // cap 50%
        vm.expectRevert(CataTreasury.BadConfig.selector);
        treasury.setRewardsRoute(address(points), 5001);

        treasury.setRewardsRoute(address(points), 5000);
        assertEq(treasury.rewardsVault(), address(points));
        // locked: cannot move to another destination
        vm.expectRevert(CataTreasury.RewardsVaultLocked.selector);
        treasury.setRewardsRoute(address(sets), 1000);
        // bps still adjustable (incl. back to 0) with the same vault or address(0)
        treasury.setRewardsRoute(address(0), 0);
        assertEq(treasury.rewardsVault(), address(points));
        assertEq(treasury.rewardsBps(), 0);
        vm.stopPrank();
    }

    function test_AuditCore_PointsPoolCannotBeWithdrawnToOwner() public {
        vm.prank(owner);
        cfg.activateCata(address(cata));
        cata.mint(address(points), 100e18);
        vm.prank(owner);
        vm.expectRevert(CataPoints.BadDestination.selector);
        points.withdrawCata(owner, 100e18);
        vm.prank(owner);
        points.withdrawCata(DEAD, 40e18);
        vm.prank(owner);
        points.withdrawCata(address(treasury), 60e18);
        assertEq(cata.balanceOf(DEAD), 40e18);
        assertEq(cata.balanceOf(address(treasury)), 60e18);
    }

    // ------------------------------------------------------------------ 2. buyback slippage

    function test_AuditCore_BuybackMinOutMustBeNearSpotQuote() public {
        vm.prank(owner);
        cfg.activateCata(address(cata));
        cata.mint(address(router), 1e30);
        vm.deal(address(treasury), 10 ether);
        assertEq(treasury.maxSlippageBps(), 300);

        // quote = 1000 CATA per BNB; floor at 3% = 970
        vm.startPrank(owner);
        vm.expectRevert(abi.encodeWithSelector(CataTreasury.MinOutTooLow.selector, 0, 970 ether));
        treasury.buyback(address(0), 1 ether, 0);
        vm.expectRevert(abi.encodeWithSelector(CataTreasury.MinOutTooLow.selector, 969 ether, 970 ether));
        treasury.buyback(address(0), 1 ether, 969 ether);
        treasury.buyback(address(0), 1 ether, 970 ether);
        assertEq(cata.balanceOf(DEAD), 1000 ether);

        // slippage cap
        vm.expectRevert(CataTreasury.BadConfig.selector);
        treasury.setMaxSlippageBps(501);
        treasury.setMaxSlippageBps(100);
        vm.expectRevert(abi.encodeWithSelector(CataTreasury.MinOutTooLow.selector, 970 ether, 990 ether));
        treasury.buyback(address(0), 1 ether, 970 ether);
        vm.stopPrank();

        vm.prank(alice);
        vm.expectRevert(CataTreasury.NotOwner.selector);
        treasury.setMaxSlippageBps(500);
    }

    function test_AuditCore_BuybackPerCallCap() public {
        vm.prank(owner);
        cfg.activateCata(address(cata));
        cata.mint(address(router), 1e30);
        vm.deal(address(treasury), 10 ether);
        vm.startPrank(owner);
        treasury.setMaxBuybackIn(address(0), 2 ether);
        vm.expectRevert(abi.encodeWithSelector(CataTreasury.AboveMaxBuyback.selector, 3 ether, 2 ether));
        treasury.buyback(address(0), 3 ether, 3000 ether);
        treasury.buyback(address(0), 2 ether, 2000 ether);
        // 0 disables
        treasury.setMaxBuybackIn(address(0), 0);
        vm.expectRevert(abi.encodeWithSelector(CataTreasury.AboveMaxBuyback.selector, 1 ether, 0));
        treasury.buyback(address(0), 1 ether, 1000 ether);
        vm.stopPrank();
    }

    // ------------------------------------------------------------------ 3. VRF retry

    function test_AuditCore_RetryOpenAfterTimeoutIgnoresOldRequest() public {
        (uint256 poolId,,,) = _pool();
        uint256 req = _openBob(poolId);
        assertEq(uint8(packs.requestStatus(req)), uint8(PackMachine.RequestStatus.Pending));
        assertEq(packs.pendingOpens(poolId), 1);

        vm.prank(bob);
        vm.expectRevert(PackMachine.RetryTooEarly.selector);
        packs.retryOpen(req);

        vm.warp(block.timestamp + 1 hours);
        vm.prank(alice);
        vm.expectRevert(PackMachine.NotAuthorized.selector);
        packs.retryOpen(req);

        vm.prank(bob);
        uint256 req2 = packs.retryOpen(req);
        assertTrue(req2 != req);
        assertEq(uint8(packs.requestStatus(req)), uint8(PackMachine.RequestStatus.Cancelled));
        assertEq(packs.pendingOpens(poolId), 1); // still a single in-flight open
        assertEq(packs.creditRequest(0), req2);
        assertEq(packs.pools(poolId).reserved, 1);

        // stale id arrives late: ignored, no revert, nothing moves
        vrf.fulfill(req, 0);
        assertEq(packs.poolCards(poolId).length, 3);
        assertEq(vault.balanceOf(bob), 0);
        // cannot retry a cancelled id
        vm.prank(bob);
        vm.expectRevert(PackMachine.NotPending.selector);
        packs.retryOpen(req);

        vrf.fulfill(req2, 0);
        assertEq(vault.balanceOf(bob), 1);
        assertEq(packs.pendingOpens(poolId), 0);
        assertEq(packs.pools(poolId).reserved, 0);
        assertEq(uint8(packs.requestStatus(req2)), uint8(PackMachine.RequestStatus.Fulfilled));
        // duplicate fulfillment ignored
        vrf.fulfill(req2, 1);
        assertEq(vault.balanceOf(bob), 1);
        assertEq(packs.poolCards(poolId).length, 2);
        vm.prank(bob);
        vm.expectRevert(PackMachine.NotPending.selector);
        packs.retryOpen(req2);
    }

    function test_AuditCore_OwnerAndGiftRecipientCanRetry() public {
        (uint256 poolId,,,) = _pool();
        uint256 req = _openBob(poolId);
        vm.warp(block.timestamp + 1 hours);
        vm.prank(owner);
        uint256 req2 = packs.retryOpen(req);
        // gift: credit held by GiftPacks; the recipient may retry
        (address signer, uint256 pk) = makeAddrAndKey("giftlink");
        vm.startPrank(alice);
        usdt.approve(address(giftPacks), 100e18);
        uint256 gid = giftPacks.buyGift(poolId, address(usdt), signer, 100e18);
        vm.stopPrank();
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, giftPacks.claimDigest(gid, bob));
        uint256 greq = giftPacks.claim(gid, bob, abi.encodePacked(r, s, v));
        assertEq(packs.pendingOpens(poolId), 2);
        vm.warp(block.timestamp + 1 hours);
        vm.prank(bob);
        uint256 greq2 = packs.retryOpen(greq);
        assertEq(packs.pendingOpens(poolId), 2);
        vrf.fulfill(req2, 0);
        vrf.fulfill(greq2, 0);
        assertEq(packs.pendingOpens(poolId), 0);
        assertEq(vault.balanceOf(bob), 2);
        // pool composition unlocked again once all opens settled
        uint256 d = _mint(alice, "D", true);
        vm.prank(alice);
        packs.depositToPool(poolId, d, 50e18);
    }

    // ------------------------------------------------------------------ 4. O(1) withdraw

    function _assertIndexConsistent(uint256 poolId) internal view {
        uint256[] memory cards = packs.poolCards(poolId);
        for (uint256 i; i < cards.length; ++i) {
            assertEq(packs.cardIndex(cards[i]), i + 1);
            assertEq(packs.poolOfToken(cards[i]), poolId + 1);
        }
    }

    function test_AuditCore_WithdrawFromPoolIndexed() public {
        vm.prank(owner);
        uint256 poolId = packs.createPool("big", 100e18);
        uint256[] memory t = new uint256[](6);
        for (uint256 i; i < 6; ++i) {
            t[i] = _mint(owner, bytes32(uint256(i + 1)), true);
        }
        vm.startPrank(owner);
        vault.setApprovalForAll(address(packs), true);
        packs.stockPool(poolId, t);
        _assertIndexConsistent(poolId);

        packs.withdrawFromPool(t[1]); // middle
        assertEq(packs.cardIndex(t[1]), 0);
        assertEq(vault.ownerOf(t[1]), owner);
        _assertIndexConsistent(poolId);
        packs.withdrawFromPool(t[4]); // now last-ish
        _assertIndexConsistent(poolId);
        packs.withdrawFromPool(t[0]); // first
        _assertIndexConsistent(poolId);
        vm.stopPrank();
        assertEq(packs.poolCards(poolId).length, 3);

        // random pull keeps the index consistent too
        uint256 req = _openBob(poolId);
        vrf.fulfill(req, 0);
        _assertIndexConsistent(poolId);
        assertEq(packs.poolCards(poolId).length, 2);
        uint256 remaining = packs.poolCards(poolId)[0];
        vm.prank(owner);
        packs.withdrawFromPool(remaining);
        _assertIndexConsistent(poolId);
        assertEq(packs.poolCards(poolId).length, 1);
    }

    // ------------------------------------------------------------------ 5. buy price protection

    function test_AuditCore_BuyRevertsAboveMaxPrice() public {
        (uint256 poolId,,,) = _pool();
        vm.prank(owner);
        packs.updatePool(poolId, 150e18, true); // owner raises price after user signed
        vm.startPrank(bob);
        usdt.approve(address(packs), type(uint256).max);
        vm.expectRevert(abi.encodeWithSelector(PackMachine.PriceAboveMax.selector, 150e18, 100e18));
        packs.open(poolId, address(usdt), 100e18);
        vm.expectRevert(abi.encodeWithSelector(PackMachine.PriceAboveMax.selector, 150e18, 100e18));
        packs.buyCredit(poolId, address(usdt), bob, 100e18);
        usdt.approve(address(giftPacks), type(uint256).max);
        vm.expectRevert(abi.encodeWithSelector(PackMachine.PriceAboveMax.selector, 150e18, 100e18));
        giftPacks.buyGift(poolId, address(usdt), address(0xBEEF), 100e18);
        packs.open(poolId, address(usdt), 150e18);
        vm.stopPrank();
    }

    // ------------------------------------------------------------------ 6. activateCata

    function test_AuditCore_ActivateCataRejectsEoaAndNonToken() public {
        vm.startPrank(owner);
        vm.expectRevert(CataConfig.NotAToken.selector);
        cfg.activateCata(alice);
        vm.expectRevert(CataConfig.NotAToken.selector);
        cfg.activateCata(address(vault)); // ERC721: no decimals()
        assertFalse(cfg.cataActive());
        cfg.activateCata(address(cata));
        vm.expectRevert(CataConfig.AlreadyActivated.selector);
        cfg.activateCata(address(wbnb));
        vm.stopPrank();
        assertEq(cfg.cataToken(), address(cata));
    }

    // ------------------------------------------------------------------ 7. awarder role

    function test_AuditCore_AwarderRoleSeparateFromOperator() public {
        assertFalse(cfg.isOperator(address(packs)));
        assertFalse(cfg.isOperator(address(sets)));
        assertTrue(points.isAwarder(address(packs)));

        // a global operator is not an awarder
        address op = makeAddr("op");
        vm.prank(owner);
        cfg.setOperator(op, true);
        vm.prank(op);
        vm.expectRevert(CataPoints.NotAwarder.selector);
        points.award(op, 1);

        vm.prank(alice);
        vm.expectRevert(CataPayments.NotOwner.selector);
        points.setAwarder(alice, true);

        // PackMachine awards without the operator role
        (uint256 poolId,,,) = _pool();
        _openBob(poolId);
        assertEq(points.points(bob), 10);

        vm.prank(owner);
        points.setAwarder(address(packs), false);
        vm.startPrank(bob);
        usdt.approve(address(packs), 100e18);
        vm.expectRevert(CataPoints.NotAwarder.selector);
        packs.open(poolId, address(usdt), 100e18);
        vm.stopPrank();
    }
}
