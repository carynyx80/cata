// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {MarketsBase} from "./MarketsBase.sol";
import {FractionalGrails} from "../../src/markets/FractionalGrails.sol";
import {GrailShares} from "../../src/markets/GrailShares.sol";
import {CataPayments} from "../../src/lib/CataPayments.sol";
import {ICataConfig} from "../../src/interfaces/ICataConfig.sol";
import {ICataVault} from "../../src/interfaces/ICataVault.sol";
import {Features} from "../../src/lib/Features.sol";

contract FractionalGrailsTest is MarketsBase {
    FractionalGrails fg;
    uint256 card;

    function setUp() public {
        _baseSetUp();
        fg = new FractionalGrails(ICataConfig(address(cfg)), ICataVault(address(vault)));
        card = _mintCard(operator, keccak256("pikachu-illustrator"));
        vm.prank(operator); vault.setApprovalForAll(address(fg), true);
    }

    function test_FeatureOffByDefault() public {
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(CataPayments.FeatureDisabled.selector, Features.FRACTIONAL));
        fg.fractionalize(card, "Illustrator", "ILLU", address(usdt), 1 ether, 2_000_000 ether);
    }

    function test_BuySharesAndBuyoutRedeem() public {
        cfg.setFeature(Features.FRACTIONAL, true);
        vm.prank(operator);
        // 1 USDT per share, reserve 2M USDT
        uint256 id = fg.fractionalize(card, "Illustrator", "ILLU", address(usdt), 1 ether, 2_000_000 ether);
        (, GrailShares shares,,,,,,) = fg.grails(id);
        assertEq(shares.totalSupply(), 1_000_000 ether);

        vm.prank(alice); usdt.approve(address(fg), type(uint256).max);
        vm.prank(alice); fg.buyShares(id, 250_000 ether);
        assertEq(shares.balanceOf(alice), 250_000 ether);
        assertEq(usdt.balanceOf(company), 250_000 ether - _fee(250_000 ether));

        usdt.mint(bob, 2_000_000 ether);
        vm.prank(bob); usdt.approve(address(fg), type(uint256).max);
        vm.prank(bob);
        vm.expectRevert(FractionalGrails.BelowReserve.selector);
        fg.buyout(id, 1_999_999 ether);
        uint256 c0 = usdt.balanceOf(company);
        vm.prank(bob); fg.buyout(id, 2_000_000 ether);
        assertEq(vault.ownerOf(card), bob);
        uint256 net = 2_000_000 ether - _fee(2_000_000 ether);
        assertEq(usdt.balanceOf(company) - c0, (net * 750_000) / 1_000_000);

        uint256 a0 = usdt.balanceOf(alice);
        vm.prank(alice); fg.redeem(id, 250_000 ether);
        assertEq(usdt.balanceOf(alice) - a0, net - (net * 750_000) / 1_000_000);
        assertEq(shares.totalSupply(), 0);
        assertEq(usdt.balanceOf(address(fg)), 0);

        vm.prank(alice);
        vm.expectRevert(FractionalGrails.BadState.selector);
        fg.buyShares(id, 1 ether);
    }

    function test_BnbSale() public {
        cfg.setFeature(Features.FRACTIONAL, true);
        vm.prank(operator);
        uint256 id = fg.fractionalize(card, "Illustrator", "ILLU", address(0), 0.001 ether, 500 ether);
        vm.prank(alice); fg.buyShares{value: 1 ether}(id, 1_000 ether);
        assertEq(company.balance, 1 ether - _fee(1 ether));
    }
}
