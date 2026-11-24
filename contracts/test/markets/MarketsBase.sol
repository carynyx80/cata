// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockConfig, MockERC20, MockPriceIndex, MockAggregator, MockVault} from "./mocks/MarketMocks.sol";
import {Card} from "../../src/interfaces/ICataVault.sol";

abstract contract MarketsBase is Test {
    address owner = makeAddr("owner");
    address treasury = makeAddr("treasury");
    address company = makeAddr("company");
    address operator = makeAddr("operator");
    address oracle = makeAddr("oracle");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");

    MockConfig cfg;
    MockERC20 usdt;
    MockERC20 cata;
    MockPriceIndex index;
    MockAggregator bnbFeed;
    MockVault vault;

    function _baseSetUp() internal {
        vm.warp(1_700_000_000);
        usdt = new MockERC20("Tether", "USDT", 18);
        cata = new MockERC20("Cata", "CATA", 18);
        cfg = new MockConfig(owner, treasury, company, address(usdt));
        cfg.setOperator(operator, true);
        cfg.setOracle(oracle, true);
        index = new MockPriceIndex();
        bnbFeed = new MockAggregator(600e8); // $600 / BNB
        vault = new MockVault();
        address[3] memory users = [alice, bob, carol];
        for (uint256 i = 0; i < 3; i++) {
            vm.deal(users[i], 1_000 ether);
            usdt.mint(users[i], 1_000_000 ether);
            cata.mint(users[i], 1_000_000 ether);
        }
        vm.deal(operator, 100 ether);
    }

    function _mintCard(address to, bytes32 catalogId) internal returns (uint256) {
        return vault.mint(to, Card({catalogId: catalogId, grade: 10, grader: bytes16("PSA"), cert: "123", physical: true}));
    }

    function _fee(uint256 x) internal pure returns (uint256) { return (x * 20) / 10_000; }
}
