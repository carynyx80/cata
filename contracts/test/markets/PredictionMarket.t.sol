// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {MarketsBase} from "./MarketsBase.sol";
import {PredictionMarket} from "../../src/markets/PredictionMarket.sol";
import {CataPayments} from "../../src/lib/CataPayments.sol";
import {ICataConfig} from "../../src/interfaces/ICataConfig.sol";
import {ICataPriceIndex} from "../../src/interfaces/ICataPriceIndex.sol";
import {Features} from "../../src/lib/Features.sol";

contract PredictionMarketTest is MarketsBase {
    PredictionMarket pm;

    function setUp() public {
        _baseSetUp();
        pm = new PredictionMarket(ICataConfig(address(cfg)), ICataPriceIndex(address(index)));
        cfg.setFeature(Features.PREDICTIONS, true);
        vm.prank(alice); usdt.approve(address(pm), type(uint256).max);
        vm.prank(bob); usdt.approve(address(pm), type(uint256).max);
        vm.prank(carol); usdt.approve(address(pm), type(uint256).max);
        vm.prank(alice); cata.approve(address(pm), type(uint256).max);
    }

    function _pool() internal returns (uint256 id) {
        vm.prank(operator);
        id = pm.createMarket(PredictionMarket.Kind.POOL, "Charizard in pack?", 2, uint64(block.timestamp + 1 hours), "");
    }

    function test_FeatureOffReverts() public {
        cfg.setFeature(Features.PREDICTIONS, false);
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(CataPayments.FeatureDisabled.selector, Features.PREDICTIONS));
        pm.createMarket(PredictionMarket.Kind.POOL, "q", 2, uint64(block.timestamp + 1 hours), "");
    }

    function test_OnlyAllowedCreators() public {
        vm.prank(alice);
        vm.expectRevert(PredictionMarket.NotAllowedCreator.selector);
        pm.createMarket(PredictionMarket.Kind.POOL, "q", 2, uint64(block.timestamp + 1 hours), "");
        // after CATA activation, holders with >= min can create
        cfg.activateCata(address(cata));
        vm.prank(alice);
        pm.createMarket(PredictionMarket.Kind.POOL, "q", 2, uint64(block.timestamp + 1 hours), "");
        vm.prank(makeAddr("poor"));
        vm.expectRevert(PredictionMarket.NotAllowedCreator.selector);
        pm.createMarket(PredictionMarket.Kind.POOL, "q", 2, uint64(block.timestamp + 1 hours), "");
    }

    function test_BnbBetAndClaimPayoutMath() public {
        uint256 id = _pool();
        vm.prank(alice); pm.bet{value: 1 ether}(id, 0, address(0), 1 ether);
        vm.prank(bob); pm.bet{value: 3 ether}(id, 1, address(0), 3 ether);
        vm.prank(carol); pm.bet{value: 1 ether}(id, 0, address(0), 1 ether);
        assertEq(treasury.balance, _fee(1 ether) * 2 + _fee(3 ether));

        vm.warp(block.timestamp + 2 hours);
        vm.prank(oracle); pm.proposeResolution(id, 0);
        vm.expectRevert(PredictionMarket.WindowOpen.selector);
        pm.finalize(id);
        vm.warp(block.timestamp + 24 hours);
        pm.finalize(id);

        uint256 net1 = 1 ether - _fee(1 ether);
        uint256 total = net1 * 2 + (3 ether - _fee(3 ether));
        uint256 expected = (net1 * total) / (net1 * 2);
        uint256 before = alice.balance;
        vm.prank(alice); pm.claim(id, address(0));
        assertEq(alice.balance - before, expected);
        vm.prank(carol); pm.claim(id, address(0));
        vm.prank(bob);
        vm.expectRevert(PredictionMarket.NothingToClaim.selector);
        pm.claim(id, address(0));
        vm.prank(alice);
        vm.expectRevert(PredictionMarket.NothingToClaim.selector);
        pm.claim(id, address(0));
        assertLe(address(pm).balance, 1); // only rounding dust
    }

    function test_SeparateTokenPoolsAndNoWinnerRefund() public {
        uint256 id = _pool();
        // BNB: alice on 0, bob on 1 ; USDT: bob only on 1, carol on 1
        vm.prank(alice); pm.bet{value: 2 ether}(id, 0, address(0), 2 ether);
        vm.prank(bob); pm.bet{value: 2 ether}(id, 1, address(0), 2 ether);
        vm.prank(bob); pm.bet(id, 1, address(usdt), 100 ether);
        vm.prank(carol); pm.bet(id, 1, address(usdt), 300 ether);
        assertEq(pm.totalPool(id, address(0)), 4 ether - _fee(2 ether) * 2);
        assertEq(pm.totalPool(id, address(usdt)), 400 ether - _fee(100 ether) - _fee(300 ether));

        vm.warp(block.timestamp + 2 hours);
        vm.prank(operator); pm.proposeResolution(id, 0);
        vm.warp(block.timestamp + 25 hours);
        pm.finalize(id);

        // BNB winner alice takes whole BNB pool
        uint256 b0 = alice.balance;
        vm.prank(alice); pm.claim(id, address(0));
        assertEq(alice.balance - b0, 4 ether - _fee(2 ether) * 2);
        // alice has nothing in USDT
        vm.prank(alice);
        vm.expectRevert(PredictionMarket.NothingToClaim.selector);
        pm.claim(id, address(usdt));
        // nobody bet outcome 0 in USDT -> refunds of net stakes
        uint256 u0 = usdt.balanceOf(carol);
        vm.prank(carol); pm.claim(id, address(usdt));
        assertEq(usdt.balanceOf(carol) - u0, 300 ether - _fee(300 ether));
        vm.prank(bob); pm.claim(id, address(usdt));
        assertEq(usdt.balanceOf(address(pm)), 0);
    }

    function test_CataRejectedBeforeActivationAcceptedAfter() public {
        uint256 id = _pool();
        vm.prank(alice);
        vm.expectRevert(PredictionMarket.BadToken.selector);
        pm.bet(id, 0, address(cata), 10 ether);
        cfg.activateCata(address(cata));
        vm.prank(alice); pm.bet(id, 0, address(cata), 10 ether);
        assertEq(pm.totalPool(id, address(cata)), 10 ether - _fee(10 ether));
        assertEq(cata.balanceOf(treasury), _fee(10 ether));
    }

    function test_PriceMarketResolvesFromIndex() public {
        bytes32 cid = keccak256("charizard-base-psa10");
        vm.prank(operator);
        uint256 id = pm.createMarket(PredictionMarket.Kind.PRICE, "Zard >= $10k?", 2, uint64(block.timestamp + 1 days), abi.encode(cid, 10_000 ether));
        vm.prank(alice); pm.bet(id, 0, address(usdt), 100 ether);
        vm.prank(bob); pm.bet(id, 1, address(usdt), 100 ether);
        vm.warp(block.timestamp + 1 days);
        index.set(cid, 9_000 ether); // stamped at closeTime
        // set price to above threshold after close
        vm.warp(block.timestamp + 1);
        index.set(cid, 12_000 ether);
        pm.resolvePriceMarket(id);
        assertEq(uint8(pm.getMarket(id).status), uint8(PredictionMarket.Status.RESOLVED));
        assertEq(pm.getMarket(id).winningOutcome, 0);
        vm.prank(alice); pm.claim(id, address(usdt));
        assertEq(usdt.balanceOf(address(pm)), 0);
    }

    function test_PriceMarketStalePriceCannotResolve() public {
        bytes32 cid = keccak256("x");
        index.set(cid, 1 ether);
        vm.prank(operator);
        uint256 id = pm.createMarket(PredictionMarket.Kind.PRICE, "q", 2, uint64(block.timestamp + 1 days), abi.encode(cid, 2 ether));
        vm.warp(block.timestamp + 2 days);
        vm.expectRevert(PredictionMarket.TooEarly.selector);
        pm.resolvePriceMarket(id);
        index.set(cid, 1 ether);
        pm.resolvePriceMarket(id);
        assertEq(pm.getMarket(id).winningOutcome, 1);
    }

    function test_OwnerOverrideDuringWindow() public {
        uint256 id = _pool();
        vm.prank(alice); pm.bet{value: 1 ether}(id, 0, address(0), 1 ether);
        vm.warp(block.timestamp + 2 hours);
        vm.prank(oracle); pm.proposeResolution(id, 1);
        vm.prank(owner); pm.overrideResolution(id, 0);
        assertEq(pm.getMarket(id).winningOutcome, 0);
    }

    function test_CancelRefundsAll() public {
        uint256 id = _pool();
        vm.prank(alice); pm.bet{value: 1 ether}(id, 0, address(0), 1 ether);
        vm.prank(alice); pm.bet{value: 1 ether}(id, 1, address(0), 1 ether);
        vm.prank(operator); pm.cancelMarket(id);
        uint256 b0 = alice.balance;
        vm.prank(alice); pm.claim(id, address(0));
        assertEq(alice.balance - b0, 2 * (1 ether - _fee(1 ether)));
    }

    function test_BetAfterCloseReverts() public {
        uint256 id = _pool();
        vm.warp(block.timestamp + 1 hours);
        vm.prank(alice);
        vm.expectRevert(PredictionMarket.Closed.selector);
        pm.bet{value: 1 ether}(id, 0, address(0), 1 ether);
    }

    function test_SweepAfterDelay() public {
        uint256 id = _pool();
        vm.prank(alice); pm.bet{value: 1 ether}(id, 0, address(0), 1 ether);
        vm.prank(operator); pm.cancelMarket(id);
        vm.prank(owner);
        vm.expectRevert(PredictionMarket.TooEarly.selector);
        pm.sweep(address(0), 1);
        vm.warp(block.timestamp + 181 days);
        vm.prank(owner); pm.sweep(address(0), 1);
    }
}
