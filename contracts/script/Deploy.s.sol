// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {CataConfig} from "../src/core/CataConfig.sol";
import {CataTreasury} from "../src/core/CataTreasury.sol";
import {CataVault} from "../src/core/CataVault.sol";
import {CataPriceIndex} from "../src/core/CataPriceIndex.sol";
import {CataPoints} from "../src/core/CataPoints.sol";
import {SetRewards} from "../src/core/SetRewards.sol";
import {CataMarket} from "../src/core/CataMarket.sol";
import {PackMachine} from "../src/core/PackMachine.sol";
import {GiftPacks} from "../src/core/GiftPacks.sol";

/// @notice Deploys the core in order, wires roles, then hands ownership to the company wallet.
/// Env: PRIVATE_KEY (required, never committed), VRF_COORDINATOR, VRF_KEY_HASH, VRF_SUB_ID, BNB_USD_FEED,
///      optional: OWNER, USDT, PANCAKE_ROUTER, ORACLE, OPERATOR, VAULT_BASE_URI, MAX_BUYBACK_BNB, MAX_BUYBACK_USDT.
contract Deploy is Script {
    address constant COMPANY = 0x106342ec570E207afDa9fDA63125d7a9071127f2;
    address constant USDT_BSC = 0x55d398326f99059fF775485246999027B3197955;
    address constant PANCAKE_V2 = 0x10ED43C718714eb63d5aA57B78B54704E256024E;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address finalOwner = vm.envOr("OWNER", COMPANY);
        address usdt = vm.envOr("USDT", USDT_BSC);
        address router = vm.envOr("PANCAKE_ROUTER", PANCAKE_V2);
        address coordinator = vm.envAddress("VRF_COORDINATOR");
        bytes32 keyHash = vm.envBytes32("VRF_KEY_HASH");
        uint256 subId = vm.envUint("VRF_SUB_ID");
        address feed = vm.envAddress("BNB_USD_FEED");
        address oracle = vm.envOr("ORACLE", address(0));
        address operator = vm.envOr("OPERATOR", address(0));
        string memory baseURI = vm.envOr("VAULT_BASE_URI", string("https://api.cata.gg/meta/"));

        vm.startBroadcast(pk);
        // deployer owns temporarily to wire roles; ownership moves to finalOwner at the end
        CataConfig cfg = new CataConfig(deployer, COMPANY, usdt, address(0));
        CataTreasury treasury = new CataTreasury(cfg, router);
        cfg.setTreasury(address(treasury)); // one-time: locked forever after this call
        CataVault vault = new CataVault(cfg, baseURI);
        CataPriceIndex index = new CataPriceIndex(cfg);
        CataPoints points = new CataPoints(cfg);
        SetRewards sets = new SetRewards(cfg, vault, points);
        CataMarket market = new CataMarket(cfg, vault);
        PackMachine packs = new PackMachine(cfg, vault, index, points, coordinator, keyHash, subId, feed);
        GiftPacks gifts = new GiftPacks(cfg, packs);

        // PackMachine / SetRewards only need to award points: CataPoints awarder role, NOT the global operator role
        points.setAwarder(address(packs), true);
        points.setAwarder(address(sets), true);
        // buyback guards: per-call caps (0 = disabled); tune after $CATA liquidity exists
        treasury.setMaxBuybackIn(address(0), vm.envOr("MAX_BUYBACK_BNB", uint256(5 ether)));
        treasury.setMaxBuybackIn(usdt, vm.envOr("MAX_BUYBACK_USDT", uint256(3_000e18)));
        if (operator != address(0)) cfg.setOperator(operator, true); // mints slabs / stocks pools / resolves markets
        if (oracle != address(0)) cfg.setOracle(oracle, true);
        if (finalOwner != deployer) cfg.transferOwnership(finalOwner);
        vm.stopBroadcast();

        console2.log("CataConfig", address(cfg));
        console2.log("CataTreasury", address(treasury));
        console2.log("CataVault", address(vault));
        console2.log("CataPriceIndex", address(index));
        console2.log("CataPoints", address(points));
        console2.log("SetRewards", address(sets));
        console2.log("CataMarket", address(market));
        console2.log("PackMachine", address(packs));
        console2.log("GiftPacks", address(gifts));
        console2.log("NOTE: add PackMachine as a consumer on VRF subscription", subId);
    }
}
