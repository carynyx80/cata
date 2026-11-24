// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {MarketsBase} from "./MarketsBase.sol";
import {PackBattles} from "../../src/markets/PackBattles.sol";
import {IBattleRandomness} from "../../src/markets/IBattleRandomness.sol";
import {MockBattleRandomness} from "../../src/markets/mocks/MockBattleRandomness.sol";
import {CataPayments} from "../../src/lib/CataPayments.sol";
import {ICataConfig} from "../../src/interfaces/ICataConfig.sol";
import {Features} from "../../src/lib/Features.sol";

contract PackBattlesTest is MarketsBase {
    PackBattles pb;
    MockBattleRandomness rng;

    function setUp() public {
        _baseSetUp();
        rng = new MockBattleRandomness();
        pb = new PackBattles(ICataConfig(address(cfg)), IBattleRandomness(address(rng)));
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
        assertEq(bob.balance - b0, 2 ether - _fee(2 ether));
        assertEq(treasury.balance, _fee(2 ether));
    }

    function test_TieUsesRandomness() public {
        cfg.setFeature(Features.BATTLES, true);
        vm.prank(alice); usdt.approve(address(pb), type(uint256).max);
        vm.prank(bob); usdt.approve(address(pb), type(uint256).max);
        vm.prank(alice); uint256 id = pb.createBattle(address(usdt), 100 ether);
        vm.prank(bob); pb.joinBattle(id);
        vm.prank(oracle); pb.settle(id, 5 ether, 5 ether);
        uint256 a0 = usdt.balanceOf(alice);
        rng.fulfil(1, 42); // even -> playerA
        assertEq(usdt.balanceOf(alice) - a0, 200 ether - _fee(200 ether));
    }
}
