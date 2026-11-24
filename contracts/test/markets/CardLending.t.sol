// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {MarketsBase} from "./MarketsBase.sol";
import {CardLending} from "../../src/markets/CardLending.sol";
import {IAggregatorV3} from "../../src/markets/IAggregatorV3.sol";
import {CataPayments} from "../../src/lib/CataPayments.sol";
import {ICataConfig} from "../../src/interfaces/ICataConfig.sol";
import {ICataVault} from "../../src/interfaces/ICataVault.sol";
import {ICataPriceIndex} from "../../src/interfaces/ICataPriceIndex.sol";
import {Features} from "../../src/lib/Features.sol";

contract CardLendingTest is MarketsBase {
    CardLending lend;
    bytes32 cid = keccak256("lugia-neo-psa10");
    uint256 card;

    function setUp() public {
        _baseSetUp();
        lend = new CardLending(ICataConfig(address(cfg)), ICataVault(address(vault)), ICataPriceIndex(address(index)), IAggregatorV3(address(bnbFeed)));
        cfg.setFeature(Features.LENDING, true);
        index.set(cid, 10_000 ether); // $10k
        card = _mintCard(alice, cid);
        vm.prank(alice); vault.setApprovalForAll(address(lend), true);
        vm.prank(alice); usdt.approve(address(lend), type(uint256).max);
        vm.prank(bob); usdt.approve(address(lend), type(uint256).max);
        vm.prank(carol); usdt.approve(address(lend), type(uint256).max);
        vm.prank(bob); lend.deposit(address(usdt), 50_000 ether);
        vm.prank(bob); lend.deposit{value: 100 ether}(address(0), 100 ether);
    }

    function test_FeatureOff() public {
        cfg.setFeature(Features.LENDING, false);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(CataPayments.FeatureDisabled.selector, Features.LENDING));
        lend.borrow(card, address(usdt), 1 ether);
    }

    function test_BorrowUsdtRepay() public {
        assertEq(lend.totalAssets(address(usdt)), 50_000 ether - _fee(50_000 ether));
        vm.prank(alice);
        vm.expectRevert(CardLending.ExceedsLtv.selector);
        lend.borrow(card, address(usdt), 4_001 ether);

        uint256 u0 = usdt.balanceOf(alice);
        vm.prank(alice); lend.borrow(card, address(usdt), 4_000 ether);
        assertEq(usdt.balanceOf(alice) - u0, 4_000 ether - _fee(4_000 ether));
        assertEq(vault.ownerOf(card), address(lend));

        vm.warp(block.timestamp + 365 days / 12);
        uint256 debt = lend.debtOf(card);
        assertApproxEqAbs(debt, 4_000 ether + (4_000 ether * 1500 / 10_000) / 12, 1e6);
        uint256 quote = lend.payQuote(card, 0);
        uint256 t0 = usdt.balanceOf(treasury);
        vm.prank(alice); lend.repay(card, quote);
        assertEq(vault.ownerOf(card), alice);
        assertEq(usdt.balanceOf(treasury) - t0, _fee(quote));
        // lender gains interest
        assertGt(lend.totalAssets(address(usdt)), 50_000 ether - _fee(50_000 ether));
        uint256 shares = lend.sharesOf(address(usdt), bob);
        uint256 b0 = usdt.balanceOf(bob);
        vm.prank(bob); lend.withdraw(address(usdt), shares);
        assertGt(usdt.balanceOf(bob) - b0, 50_000 ether - _fee(50_000 ether));
    }

    function test_BorrowBnb() public {
        // $10k * 40% = $4000 at $600/BNB = 6.666 BNB
        uint256 maxBnb = (uint256(10_000 ether) * 4_000 / 10_000) * 1e8 / 600e8;
        vm.prank(alice);
        vm.expectRevert(CardLending.ExceedsLtv.selector);
        lend.borrow(card, address(0), maxBnb + 1);
        uint256 b0 = alice.balance;
        vm.prank(alice); lend.borrow(card, address(0), maxBnb);
        assertEq(alice.balance - b0, maxBnb - _fee(maxBnb));
    }

    function test_StalePriceBlocksBorrow() public {
        vm.warp(block.timestamp + 3 days + 1);
        bnbFeed.set(600e8);
        vm.prank(alice);
        vm.expectRevert(CardLending.StalePrice.selector);
        lend.borrow(card, address(usdt), 1 ether);
    }

    function test_LiquidateOnPriceDrop() public {
        vm.prank(alice); lend.borrow(card, address(usdt), 4_000 ether);
        uint256 q = lend.payQuote(card, 0);
        vm.prank(carol);
        vm.expectRevert(CardLending.Healthy.selector);
        lend.liquidate(card, q);
        index.set(cid, 6_000 ether); // 4000 > 60% of 6000 = 3600
        assertTrue(lend.isLiquidatable(card));
        vm.prank(carol); lend.liquidate(card, q);
        assertEq(vault.ownerOf(card), carol);
        (,,,,, bool active,) = lend.loans(card);
        assertFalse(active);
    }

    function test_LiquidateWhenOverdue() public {
        vm.prank(alice); lend.borrow(card, address(usdt), 1_000 ether);
        vm.warp(block.timestamp + 31 days);
        uint256 q = lend.payQuote(card, 0);
        vm.prank(carol); lend.liquidate(card, q);
        assertEq(vault.ownerOf(card), carol);
    }

    function test_RepayInsufficientReverts() public {
        vm.prank(alice); lend.borrow(card, address(usdt), 1_000 ether);
        vm.prank(alice);
        vm.expectRevert(CardLending.Insufficient.selector);
        lend.repay(card, 1_000 ether); // net after fee < debt
    }
}
