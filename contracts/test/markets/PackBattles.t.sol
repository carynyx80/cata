// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {MarketsBase} from "./MarketsBase.sol";
import {PackBattles} from "../../src/markets/PackBattles.sol";
import {CataPayments} from "../../src/lib/CataPayments.sol";
import {ICataConfig} from "../../src/interfaces/ICataConfig.sol";
import {Features} from "../../src/lib/Features.sol";

contract PackBattlesTest is MarketsBase {
    PackBattles pb;

    function setUp() public {
        _baseSetUp();
        pb = new PackBattles(ICataConfig(address(cfg)));
    }

    function test_FeatureOffByDefault() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(CataPayments.FeatureDisabled.selector, Features.BATTLES));
        pb.createBattle{value: 1 ether}(address(0), 1 ether);
    }

    function test_BattleWinnerTakesPotMinusFee() public {
        cfg.setFeature(Features.BATTLES, true);
        vm.prank(alice); uint256 id = pb.createBattle{value: 1 ether}(address(0), 1 ether);
        vm.prank(bob); pb.joinBattle{value: 1 ether}(id);
        vm.prank(alice);
        vm.expectRevert(PackBattles.NotAuthorized.selector);
        pb.settle(id, 1, 2);
        uint256 b0 = bob.balance;
        vm.prank(oracle); pb.settle(id, 50 ether, 120 ether);
        assertEq(pb.owed(address(0), bob), 2 ether - _fee(2 ether));
        vm.prank(bob); pb.withdraw(address(0));
        assertEq(bob.balance - b0, 2 ether - _fee(2 ether));
        assertEq(treasury.balance, _fee(2 ether));
    }

    function test_TieSplitsPot() public {
        cfg.setFeature(Features.BATTLES, true);
        vm.prank(alice); usdt.approve(address(pb), type(uint256).max);
        vm.prank(bob); usdt.approve(address(pb), type(uint256).max);
        vm.prank(alice); uint256 id = pb.createBattle(address(usdt), 100 ether);
        vm.prank(bob); pb.joinBattle(id);
        vm.prank(oracle); pb.settle(id, 5 ether, 5 ether);
        uint256 net = 200 ether - _fee(200 ether);
        assertEq(pb.owed(address(usdt), alice), net / 2);
        assertEq(pb.owed(address(usdt), bob), net - net / 2);
        uint256 a0 = usdt.balanceOf(alice);
        vm.prank(alice); pb.withdraw(address(usdt));
        assertEq(usdt.balanceOf(alice) - a0, net / 2);
    }
}
