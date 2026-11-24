// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {MarketsBase} from "./MarketsBase.sol";
import {LiveRips} from "../../src/markets/LiveRips.sol";
import {CataPayments} from "../../src/lib/CataPayments.sol";
import {ICataConfig} from "../../src/interfaces/ICataConfig.sol";
import {ICataVault} from "../../src/interfaces/ICataVault.sol";
import {Features} from "../../src/lib/Features.sol";

contract LiveRipsTest is MarketsBase {
    LiveRips rips;

    function setUp() public {
        _baseSetUp();
        rips = new LiveRips(ICataConfig(address(cfg)), ICataVault(address(vault)));
        cfg.setFeature(Features.LIVE_RIPS, true);
    }

    function test_FeatureOff() public {
        cfg.setFeature(Features.LIVE_RIPS, false);
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(CataPayments.FeatureDisabled.selector, Features.LIVE_RIPS));
        rips.createSession("Booster box", 36, 10 ether, address(usdt));
    }

    function test_BuySpotsRipAssign() public {
        vm.prank(operator);
        uint256 id = rips.createSession("Evolving Skies booster box", 3, 0.1 ether, address(0));
        vm.prank(alice); rips.buySpots{value: 0.2 ether}(id, 2);
        vm.prank(bob); rips.buySpots{value: 0.1 ether}(id, 1);
        vm.prank(carol);
        vm.expectRevert(LiveRips.SoldOut.selector);
        rips.buySpots{value: 0.1 ether}(id, 1);
        assertEq(treasury.balance, _fee(0.2 ether) + _fee(0.1 ether));
        assertEq(rips.spotOwner(id, 0), alice);
        assertEq(rips.spotOwner(id, 2), bob);

        vm.prank(operator); rips.markRipped(id);
        assertEq(company.balance, 0); // escrow held until every sold spot is assigned

        uint256 t0 = _mintCard(address(rips), keccak256("z"));
        uint256 t1 = _mintCard(address(rips), keccak256("a"));
        uint256 t2 = _mintCard(address(rips), keccak256("b"));
        uint32[] memory spots = new uint32[](2);
        spots[0] = 1; spots[1] = 2;
        uint256[] memory ids = new uint256[](2);
        ids[0] = t1; ids[1] = t2;
        vm.prank(operator); rips.assignCards(id, spots, ids);
        assertEq(vault.ownerOf(t1), alice);
        assertEq(vault.ownerOf(t2), bob);
        assertEq(company.balance, 0);
        uint32[] memory s0 = new uint32[](1);
        uint256[] memory i0 = new uint256[](1);
        i0[0] = t0;
        vm.prank(operator); rips.assignCards(id, s0, i0);
        assertEq(company.balance, 0.3 ether - _fee(0.2 ether) - _fee(0.1 ether));
    }

    function test_CancelRefund() public {
        vm.prank(operator);
        uint256 id = rips.createSession("box", 5, 10 ether, address(usdt));
        vm.prank(alice); usdt.approve(address(rips), type(uint256).max);
        vm.prank(alice); rips.buySpots(id, 1);
        vm.prank(operator); rips.cancelSession(id);
        uint256 b0 = usdt.balanceOf(alice);
        rips.refundSpot(id, 0);
        assertEq(usdt.balanceOf(alice) - b0, 10 ether - _fee(10 ether));
    }
}
