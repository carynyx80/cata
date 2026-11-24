// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {MarketsBase} from "./MarketsBase.sol";
import {CardLending} from "../../src/markets/CardLending.sol";
import {PackBattles} from "../../src/markets/PackBattles.sol";
import {LiveRips} from "../../src/markets/LiveRips.sol";
import {PredictionMarket} from "../../src/markets/PredictionMarket.sol";
import {IAggregatorV3} from "../../src/markets/IAggregatorV3.sol";
import {ICataConfig} from "../../src/interfaces/ICataConfig.sol";
import {ICataVault} from "../../src/interfaces/ICataVault.sol";
import {ICataPriceIndex} from "../../src/interfaces/ICataPriceIndex.sol";
import {Features} from "../../src/lib/Features.sol";

/// @dev A player whose address rejects BNB.
contract BnbRejecter {
    function create(PackBattles pb, uint256 entry) external payable returns (uint256) {
        return pb.createBattle{value: entry}(address(0), entry);
    }
    receive() external payable { revert("no"); }
}

contract AuditMarketsLendingTest is MarketsBase {
    CardLending lend;
    bytes32 cid = keccak256("lugia-neo-psa10");
    uint256 card;

    function setUp() public {
        _baseSetUp();
        lend = new CardLending(ICataConfig(address(cfg)), ICataVault(address(vault)), ICataPriceIndex(address(index)), IAggregatorV3(address(bnbFeed)));
        cfg.setFeature(Features.LENDING, true);
        index.set(cid, 10_000 ether);
        card = _mintCard(alice, cid);
        vm.prank(alice); vault.setApprovalForAll(address(lend), true);
        address[3] memory u = [alice, bob, carol];
        for (uint256 i = 0; i < 3; i++) { vm.prank(u[i]); usdt.approve(address(lend), type(uint256).max); }
        vm.prank(company); usdt.approve(address(lend), type(uint256).max);
        usdt.mint(company, 100_000 ether);
    }

    function _withdrawAll(address who) internal returns (uint256 got) {
        uint256 b0 = usdt.balanceOf(who);
        uint256 sh = lend.sharesOf(address(usdt), who);
        vm.prank(who); lend.withdraw(address(usdt), sh);
        got = usdt.balanceOf(who) - b0;
    }

    /// Fix 1: share price includes accrued interest, so a just-in-time deposit before a big repay
    /// does not capture interest accrued before it joined.
    function test_JitDepositCannotSkimInterest() public {
        vm.prank(bob); lend.deposit(address(usdt), 10_000 ether);
        vm.prank(alice); lend.borrow(card, address(usdt), 4_000 ether);
        vm.warp(block.timestamp + 29 days);
        uint256 accrued = lend.accruedInterest(address(usdt));
        assertApproxEqAbs(accrued, lend.debtOf(card) - 4_000 ether, 2);
        assertGt(accrued, 40 ether);

        // carol deposits right before the repay
        vm.prank(carol); lend.deposit(address(usdt), 10_000 ether);
        uint256 carolNet = 10_000 ether - _fee(10_000 ether);
        uint256 q = lend.payQuote(card, 0);
        vm.prank(alice); lend.repay(card, q);

        uint256 carolGot = _withdrawAll(carol);
        assertLe(carolGot, carolNet); // no skim (rounding is in the pool's favour)
        assertApproxEqAbs(carolGot, carolNet, 1e6);
        uint256 bobGot = _withdrawAll(bob);
        assertApproxEqAbs(bobGot, 10_000 ether - _fee(10_000 ether) + accrued, 1e6);
    }

    /// Fix 1 (accounting): changing the APR does not change an open loan's debt or the pool's books.
    function test_AprChangeKeepsAccountingConsistent() public {
        vm.prank(bob); lend.deposit(address(usdt), 10_000 ether);
        vm.prank(alice); lend.borrow(card, address(usdt), 4_000 ether);
        vm.warp(block.timestamp + 10 days);
        uint256 d0 = lend.debtOf(card);
        vm.prank(owner); lend.setParams(4_000, 6_000, 5_000, 30 days, 3 days);
        assertEq(lend.debtOf(card), d0);
        vm.warp(block.timestamp + 5 days);
        uint256 q = lend.payQuote(card, 0);
        vm.prank(alice); lend.repay(card, q);
        assertEq(lend.accruedInterest(address(usdt)), 0);
        assertEq(lend.totalAssets(address(usdt)), usdt.balanceOf(address(lend)));
    }

    /// Fix 2: past due + grace, an unliquidated loan can be written off; the last lender can then
    /// withdraw (absorbing the loss) and the NFT goes to the company wallet.
    function test_WriteOffLetsLastLenderWithdraw() public {
        vm.prank(bob); lend.deposit(address(usdt), 4_000 ether);
        vm.prank(alice); lend.borrow(card, address(usdt), 3_990 ether);
        vm.warp(block.timestamp + 30 days + 7 days);
        vm.expectRevert(CardLending.NotWritable.selector);
        lend.writeOff(card);
        // before write-off, the lender cannot get out
        uint256 sh = lend.sharesOf(address(usdt), bob);
        vm.prank(bob);
        vm.expectRevert(CardLending.NoLiquidity.selector);
        lend.withdraw(address(usdt), sh);

        vm.warp(block.timestamp + 1);
        vm.prank(carol); lend.writeOff(card);
        assertEq(vault.ownerOf(card), company);
        (,,,,, bool active,) = lend.loans(card);
        assertFalse(active);
        uint256 got = _withdrawAll(bob);
        assertApproxEqAbs(got, 4_000 ether - _fee(4_000 ether) - 3_990 ether, 1e6);
        assertEq(lend.totalAssets(address(usdt)), usdt.balanceOf(address(lend)));
    }

    /// Fix 2: sale proceeds donated back raise the share price for remaining lenders.
    function test_DonateReturnsSaleProceedsToLenders() public {
        vm.prank(bob); lend.deposit(address(usdt), 10_000 ether);
        vm.prank(alice); lend.borrow(card, address(usdt), 4_000 ether);
        vm.warp(block.timestamp + 38 days);
        lend.writeOff(card);
        vm.prank(company); lend.donate(address(usdt), 5_000 ether);
        uint256 got = _withdrawAll(bob);
        assertApproxEqAbs(got, 10_000 ether - _fee(10_000 ether) + 1_000 ether, 1e6);
    }

    /// Fix 6: donate() must not enable a first-depositor share-inflation attack.
    function test_DonationInflationAttackFails() public {
        vm.prank(carol); lend.deposit(address(usdt), 1_000); // tiny first deposit
        vm.prank(carol); lend.donate(address(usdt), 10_000 ether);
        vm.prank(bob); lend.deposit(address(usdt), 10_000 ether);
        uint256 bobNet = 10_000 ether - _fee(10_000 ether);
        uint256 got = _withdrawAll(bob);
        assertApproxEqRel(got, bobNet, 1e12); // within 0.0001%
    }
}

contract AuditMarketsBattlesTest is MarketsBase {
    PackBattles pb;
    BnbRejecter rej;

    function setUp() public {
        _baseSetUp();
        pb = new PackBattles(ICataConfig(address(cfg)));
        cfg.setFeature(Features.BATTLES, true);
        rej = new BnbRejecter();
        vm.deal(address(rej), 10 ether);
    }

    function _battle() internal returns (uint256 id) {
        id = rej.create{value: 1 ether}(pb, 1 ether);
        vm.prank(bob); pb.joinBattle{value: 1 ether}(id);
    }

    /// Fix 3: a BNB-rejecting playerA cannot block bob's winnings.
    function test_RejectingPlayerCannotBlockWinner() public {
        uint256 id = _battle();
        vm.prank(oracle); pb.settle(id, 1 ether, 2 ether);
        uint256 b0 = bob.balance;
        vm.prank(bob); pb.withdraw(address(0));
        assertEq(bob.balance - b0, 2 ether - _fee(2 ether));
    }

    /// Fix 3: ties split the pot equally with no randomness / owner input.
    function test_TieSplitWithRejectingPlayer() public {
        uint256 id = _battle();
        vm.prank(oracle); pb.settle(id, 3 ether, 3 ether);
        uint256 net = 2 ether - _fee(2 ether);
        (,,,,,,,, address winner) = pb.battles(id);
        assertEq(winner, address(0));
        assertEq(pb.owed(address(0), address(rej)), net / 2);
        uint256 b0 = bob.balance;
        vm.prank(bob); pb.withdraw(address(0));
        assertEq(bob.balance - b0, net - net / 2);
        vm.expectRevert(PackBattles.NothingOwed.selector);
        vm.prank(bob); pb.withdraw(address(0));
    }

    /// Fix 3: refundExpired credits both; one rejecting player cannot block the other's refund.
    function test_RefundExpiredPull() public {
        uint256 id = _battle();
        vm.warp(block.timestamp + 7 days);
        pb.refundExpired(id);
        uint256 b0 = bob.balance;
        vm.prank(bob); pb.withdraw(address(0));
        assertEq(bob.balance - b0, 1 ether);
        assertEq(pb.owed(address(0), address(rej)), 1 ether);
    }
}

contract AuditMarketsRipsTest is MarketsBase {
    LiveRips rips;

    function setUp() public {
        _baseSetUp();
        rips = new LiveRips(ICataConfig(address(cfg)), ICataVault(address(vault)));
        cfg.setFeature(Features.LIVE_RIPS, true);
    }

    function _one(uint32 spot, uint256 tokenId) internal pure returns (uint32[] memory s, uint256[] memory t) {
        s = new uint32[](1); s[0] = spot;
        t = new uint256[](1); t[0] = tokenId;
    }

    function _session() internal returns (uint256 id) {
        vm.prank(operator); id = rips.createSession("box", 4, 1 ether, address(0));
        vm.prank(alice); rips.buySpots{value: 2 ether}(id, 2);
        vm.prank(bob); rips.buySpots{value: 1 ether}(id, 1);
        vm.prank(operator); rips.markRipped(id);
    }

    /// Fix 4: each spot assigned once, each card assigned once, only sold spots.
    function test_AssignmentUniqueness() public {
        uint256 id = _session();
        uint256 c1 = _mintCard(address(rips), "a");
        uint256 c2 = _mintCard(address(rips), "b");
        (uint32[] memory s, uint256[] memory t) = _one(0, c1);
        vm.prank(operator); rips.assignCards(id, s, t);
        // spot 0 again
        (s, t) = _one(0, c2);
        vm.prank(operator); vm.expectRevert(LiveRips.AlreadyAssigned.selector); rips.assignCards(id, s, t);
        // unsold spot 3
        (s, t) = _one(3, c2);
        vm.prank(operator); vm.expectRevert(LiveRips.BadSpot.selector); rips.assignCards(id, s, t);
        // card c1 re-deposited and assigned again (even in another session)
        vm.prank(alice); vault.transferFrom(alice, address(rips), c1);
        (s, t) = _one(1, c1);
        vm.prank(operator); vm.expectRevert(LiveRips.AlreadyAssigned.selector); rips.assignCards(id, s, t);
        assertEq(company.balance, 0);
    }

    /// Fix 4: escrow released only when every sold spot is assigned.
    function test_EscrowReleasedOnLastAssignment() public {
        uint256 id = _session();
        uint256 net = 3 ether - _fee(2 ether) - _fee(1 ether);
        for (uint32 i = 0; i < 3; i++) {
            assertEq(company.balance, 0);
            (uint32[] memory s, uint256[] memory t) = _one(i, _mintCard(address(rips), bytes32(uint256(i + 1))));
            vm.prank(operator); rips.assignCards(id, s, t);
        }
        assertEq(company.balance, net);
        (,,,,, LiveRips.Status st,,,) = rips.sessions(id);
        assertEq(uint8(st), uint8(LiveRips.Status.COMPLETE));
        vm.prank(operator); vm.expectRevert(LiveRips.BadState.selector); rips.cancelSession(id);
    }

    /// Fix 4: cancel after partial assignment: unassigned spots refunded, assigned spot's escrow to company.
    function test_CancelAfterPartialAssignment() public {
        uint256 id = _session();
        (uint32[] memory s, uint256[] memory t) = _one(2, _mintCard(address(rips), "x")); // bob's spot
        vm.prank(operator); rips.assignCards(id, s, t);
        vm.prank(operator); rips.cancelSession(id);
        assertEq(company.balance, 1 ether - _fee(1 ether));
        vm.expectRevert(LiveRips.BadSpot.selector);
        rips.refundSpot(id, 2);
        uint256 a0 = alice.balance;
        rips.refundSpot(id, 0);
        rips.refundSpot(id, 1);
        assertEq(alice.balance - a0, 2 ether - _fee(2 ether));
        assertEq(address(rips).balance, 0);
    }
}

contract AuditMarketsPredictionTest is MarketsBase {
    PredictionMarket pm;

    function setUp() public {
        _baseSetUp();
        pm = new PredictionMarket(ICataConfig(address(cfg)), ICataPriceIndex(address(index)));
        cfg.setFeature(Features.PREDICTIONS, true);
        vm.prank(alice); usdt.approve(address(pm), type(uint256).max);
        vm.prank(bob); usdt.approve(address(pm), type(uint256).max);
        vm.prank(carol); usdt.approve(address(pm), type(uint256).max);
    }

    function _market() internal returns (uint256 id) {
        vm.prank(operator);
        id = pm.createMarket(PredictionMarket.Kind.POOL, "q", 3, uint64(block.timestamp + 1 hours), "");
    }

    /// Fix 5: dust sweep is per market/token, only after all winning stake claimed, and only
    /// takes rounding dust (winners' funds untouched).
    function test_SweepDustPerMarketOnlyDust() public {
        uint256 id = _market();
        uint256 other = _market(); // an open market elsewhere does not block or get touched
        vm.prank(alice); pm.bet(id, 0, address(usdt), 1 ether);
        vm.prank(bob); pm.bet(id, 0, address(usdt), 1 ether);
        vm.prank(carol); pm.bet(id, 1, address(usdt), 1 ether + 7);
        vm.prank(carol); pm.bet(other, 1, address(usdt), 5 ether);
        vm.warp(block.timestamp + 1 hours);
        vm.prank(oracle); pm.proposeResolution(id, 0);
        vm.warp(block.timestamp + 1 days);
        pm.finalize(id);

        vm.prank(alice); pm.claim(id, address(usdt));
        assertEq(pm.dustOf(id, address(usdt)), 0);
        vm.expectRevert(PredictionMarket.NothingToClaim.selector);
        pm.sweepDust(id, address(usdt));

        uint256 bobOwed = pm.claimable(id, address(usdt), bob);
        assertGt(bobOwed, 0);
        vm.prank(bob); pm.claim(id, address(usdt));
        uint256 dust = pm.dustOf(id, address(usdt));
        assertLe(dust, 2);
        uint256 t0 = usdt.balanceOf(treasury);
        if (dust > 0) {
            pm.sweepDust(id, address(usdt));
            assertEq(usdt.balanceOf(treasury) - t0, dust);
        }
        // the other market's funds are fully intact
        assertEq(usdt.balanceOf(address(pm)), pm.totalPool(other, address(usdt)));
    }

    /// Fix 5: cancelled markets have no dust; refunds stay claimable.
    function test_CancelledMarketNoSweep() public {
        uint256 id = _market();
        vm.prank(alice); pm.bet(id, 0, address(usdt), 1 ether);
        vm.prank(operator); pm.cancelMarket(id);
        vm.expectRevert(PredictionMarket.NothingToClaim.selector);
        pm.sweepDust(id, address(usdt));
        vm.warp(block.timestamp + 1000 days);
        vm.prank(alice); pm.claim(id, address(usdt));
        assertEq(usdt.balanceOf(address(pm)), 0);
    }
}
