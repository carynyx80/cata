// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CataConfig} from "../../src/core/CataConfig.sol";
import {CataTreasury} from "../../src/core/CataTreasury.sol";
import {CataVault} from "../../src/core/CataVault.sol";
import {CataPriceIndex} from "../../src/core/CataPriceIndex.sol";
import {CataPoints} from "../../src/core/CataPoints.sol";
import {SetRewards} from "../../src/core/SetRewards.sol";
import {CataMarket} from "../../src/core/CataMarket.sol";
import {PackMachine} from "../../src/core/PackMachine.sol";
import {GiftPacks} from "../../src/core/GiftPacks.sol";
import {ICataConfig} from "../../src/interfaces/ICataConfig.sol";
import {ICataVault, Card} from "../../src/interfaces/ICataVault.sol";
import {ICataPriceIndex} from "../../src/interfaces/ICataPriceIndex.sol";
import {Features} from "../../src/lib/Features.sol";
import {CataPayments} from "../../src/lib/CataPayments.sol";
import {MockERC20, MockVRFCoordinator, MockAggregator, MockRouter} from "../../src/mocks/Mocks.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract PaymentsHarness is CataPayments {
    constructor(ICataConfig c) CataPayments(c) {}

    function allowed(address t) external view returns (bool) {
        return _isAllowedToken(t);
    }

    function pay(address token, uint256 amount) external payable returns (uint256) {
        _pull(token, msg.sender, amount);
        return _takeFee(token, amount);
    }
}

contract CoreTest is Test {
    address constant DEAD = 0x000000000000000000000000000000000000dEaD;
    address owner = address(0x106342ec570E207afDa9fDA63125d7a9071127f2);
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address oracle = makeAddr("oracle");

    MockERC20 usdt;
    MockERC20 cata;
    MockERC20 wbnb;
    CataConfig cfg;
    CataTreasury treasury;
    CataVault vault;
    CataPriceIndex index;
    CataPoints points;
    SetRewards sets;
    CataMarket market;
    PackMachine packs;
    GiftPacks giftPacks;
    MockVRFCoordinator vrf;
    MockAggregator feed;
    MockRouter router;

    function setUp() public {
        usdt = new MockERC20("USDT", "USDT");
        cata = new MockERC20("CATA", "CATA");
        wbnb = new MockERC20("WBNB", "WBNB");
        router = new MockRouter(address(wbnb));
        vrf = new MockVRFCoordinator();
        feed = new MockAggregator(600e8); // $600 / BNB

        vm.startPrank(owner);
        cfg = new CataConfig(owner, owner, address(usdt), address(0));
        treasury = new CataTreasury(cfg, address(router));
        cfg.setTreasury(address(treasury));
        vault = new CataVault(cfg, "ipfs://");
        index = new CataPriceIndex(cfg);
        points = new CataPoints(cfg);
        sets = new SetRewards(cfg, vault, points);
        market = new CataMarket(cfg, vault);
        packs = new PackMachine(cfg, vault, index, points, address(vrf), bytes32("kh"), 1, address(feed));
        giftPacks = new GiftPacks(cfg, packs);
        cfg.setOperator(owner, true);
        cfg.setOperator(address(packs), true);
        cfg.setOperator(address(sets), true);
        cfg.setOracle(oracle, true);
        vm.stopPrank();

        usdt.mint(alice, 1_000_000e18);
        usdt.mint(bob, 1_000_000e18);
        usdt.mint(owner, 1_000_000e18);
        vm.deal(alice, 1000 ether);
        vm.deal(bob, 1000 ether);
    }

    function _mint(address to, bytes32 cid, bool physical) internal returns (uint256) {
        vm.prank(owner);
        return vault.mint(to, Card(cid, 10, bytes16("PSA"), "12345678", physical));
    }

    // ---------------------------------------------------------- config / fees

    function test_Defaults() public view {
        assertEq(cfg.feeBps(), 20);
        assertEq(cfg.cataToken(), address(0));
        assertFalse(cfg.cataActive());
        assertTrue(cfg.featureEnabled(Features.PACKS));
        assertTrue(cfg.featureEnabled(Features.LENDING));
        assertFalse(cfg.featureEnabled(Features.PREDICTIONS));
        assertFalse(cfg.featureEnabled(Features.BATTLES));
        assertFalse(cfg.featureEnabled(Features.FRACTIONAL));
        assertEq(cfg.owner(), owner);
    }

    function test_FeeMath20Bps() public {
        PaymentsHarness h = new PaymentsHarness(cfg);
        vm.startPrank(alice);
        usdt.approve(address(h), type(uint256).max);
        uint256 net = h.pay(address(usdt), 1000e18);
        assertEq(net, 998e18);
        assertEq(usdt.balanceOf(address(treasury)), 2e18);
        uint256 netBnb = h.pay{value: 1 ether}(address(0), 1 ether);
        vm.stopPrank();
        assertEq(netBnb, 0.998 ether);
        assertEq(address(treasury).balance, 0.002 ether);
    }

    function test_FeeBpsBounds() public {
        vm.prank(owner);
        vm.expectRevert(CataConfig.FeeTooHigh.selector);
        cfg.setFeeBps(101);
        vm.prank(alice);
        vm.expectRevert();
        cfg.setFeeBps(10);
    }

    function test_ActivateCataOnce() public {
        vm.prank(alice);
        vm.expectRevert();
        cfg.activateCata(address(cata));

        vm.prank(owner);
        vm.expectRevert(CataConfig.ZeroAddress.selector);
        cfg.activateCata(address(0));

        vm.prank(owner);
        cfg.activateCata(address(cata));
        assertEq(cfg.cataToken(), address(cata));
        assertTrue(cfg.cataActive());

        vm.prank(owner);
        vm.expectRevert(CataConfig.AlreadyActivated.selector);
        cfg.activateCata(address(wbnb));
        assertEq(cfg.cataToken(), address(cata));
    }

    function test_AllowedTokensBeforeAfterActivation() public {
        PaymentsHarness h = new PaymentsHarness(cfg);
        assertTrue(h.allowed(address(0)));
        assertTrue(h.allowed(address(usdt)));
        assertFalse(h.allowed(address(cata)));
        assertFalse(h.allowed(address(wbnb)));
        vm.prank(owner);
        cfg.activateCata(address(cata));
        assertTrue(h.allowed(address(cata)));
        assertFalse(h.allowed(address(wbnb)));
    }

    // ---------------------------------------------------------- market

    function test_MarketBuyBnb() public {
        uint256 id = _mint(alice, "charizard", true);
        vm.startPrank(alice);
        vault.approve(address(market), id);
        uint256 lid = market.list(id, address(0), 10 ether);
        vm.stopPrank();
        uint256 before = alice.balance;
        vm.prank(bob);
        market.buy{value: 10 ether}(lid);
        assertEq(vault.ownerOf(id), bob);
        assertEq(alice.balance - before, 9.98 ether);
        assertEq(address(treasury).balance, 0.02 ether);
    }

    function test_MarketBuyUsdtAndCancel() public {
        uint256 id = _mint(alice, "pikachu", true);
        vm.startPrank(alice);
        vault.approve(address(market), id);
        uint256 lid = market.list(id, address(usdt), 500e18);
        vm.stopPrank();
        uint256 before = usdt.balanceOf(alice);
        vm.startPrank(bob);
        usdt.approve(address(market), 500e18);
        market.buy(lid);
        vm.stopPrank();
        assertEq(vault.ownerOf(id), bob);
        assertEq(usdt.balanceOf(alice) - before, 499e18);
        assertEq(usdt.balanceOf(address(treasury)), 1e18);

        vm.startPrank(bob);
        vault.approve(address(market), id);
        uint256 lid2 = market.list(id, address(usdt), 1e18);
        market.cancel(lid2);
        vm.stopPrank();
        assertEq(vault.ownerOf(id), bob);
    }

    function test_MarketCataOnlyAfterActivation() public {
        uint256 id = _mint(alice, "mew", true);
        vm.startPrank(alice);
        vault.approve(address(market), id);
        vm.expectRevert(abi.encodeWithSelector(CataPayments.TokenNotAllowed.selector, address(cata)));
        market.list(id, address(cata), 1e18);
        vm.stopPrank();
        vm.prank(owner);
        cfg.activateCata(address(cata));
        vm.prank(alice);
        market.list(id, address(cata), 1e18);
    }

    // ---------------------------------------------------------- vault

    function test_VaultRedeemBurn() public {
        uint256 id = _mint(alice, "lugia", true);
        vm.prank(bob);
        vm.expectRevert(CataVault.NotTokenOwner.selector);
        vault.burnForRedeem(id);
        vm.expectEmit(true, true, false, true);
        emit CataVault.RedeemRequested(id, alice, "12345678");
        vm.prank(alice);
        vault.burnForRedeem(id);
        vm.expectRevert();
        vault.ownerOf(id);
    }

    function test_VaultDigitalCannotRedeem() public {
        uint256 id = _mint(alice, "digital", false);
        vm.prank(alice);
        vm.expectRevert(CataVault.NotPhysical.selector);
        vault.burnForRedeem(id);
    }

    function test_VaultMintOperatorOnly() public {
        vm.prank(alice);
        vm.expectRevert(CataVault.NotOperator.selector);
        vault.mint(alice, Card("x", 9, bytes16("BGS"), "1", true));
    }

    // ---------------------------------------------------------- price index

    function test_PriceIndex() public {
        bytes32[] memory ids = new bytes32[](1);
        uint256[] memory ps = new uint256[](1);
        ids[0] = "charizard";
        ps[0] = 1000e18;
        vm.expectRevert(CataPriceIndex.NotOracle.selector);
        index.setPrices(ids, ps);
        vm.prank(oracle);
        index.setPrices(ids, ps);
        (uint256 p, uint64 at) = index.priceUsd("charizard");
        assertEq(p, 1000e18);
        assertEq(at, block.timestamp);
    }

    // ---------------------------------------------------------- packs

    function _setupPool() internal returns (uint256 poolId, uint256 a, uint256 b, uint256 c) {
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
        vault.approve(address(packs), c);
        packs.depositToPool(poolId, c, 50e18);
        vm.stopPrank();
    }

    function test_PackOpenUsdtWithVrf() public {
        (uint256 poolId,,, uint256 c) = _setupPool();
        assertEq(packs.poolCards(poolId).length, 3);
        vm.startPrank(bob);
        usdt.approve(address(packs), 100e18);
        uint256 req = packs.open(poolId, address(usdt));
        vm.stopPrank();
        assertEq(usdt.balanceOf(address(treasury)), 0.2e18);
        assertEq(points.points(bob), 10);
        (bytes32 kh, uint256 sub,,, uint32 nw,) = vrf.lastRequest();
        assertEq(kh, bytes32("kh"));
        assertEq(sub, 1);
        assertEq(nw, 1);

        vrf.fulfill(req, 2); // index 2 => alice's community card C
        assertEq(vault.ownerOf(c), bob);
        assertEq(packs.poolCards(poolId).length, 2);
        // net 99.8; alice ask 50/100 => 49.9 gross, fee 0.0998 => 49.8002
        assertEq(packs.owed(address(usdt), alice), 49.8002e18);
        assertEq(packs.owed(address(usdt), owner), 49.9e18);
        assertEq(packs.owed(address(usdt), address(treasury)), 0.0998e18);
        uint256 before = usdt.balanceOf(alice);
        vm.prank(alice);
        packs.withdraw(address(usdt));
        assertEq(usdt.balanceOf(alice) - before, 49.8002e18);
        packs.flushFees(address(usdt));
        assertEq(usdt.balanceOf(address(treasury)), 0.2998e18);
    }

    function test_PackOpenBnbQuoteAndRefund() public {
        (uint256 poolId,,,) = _setupPool();
        uint256 q = packs.quote(poolId, address(0));
        assertEq(q, 166666666666666667); // $100 / $600, rounded up
        uint256 before = bob.balance;
        vm.prank(bob);
        uint256 req = packs.open{value: 1 ether}(poolId, address(0));
        assertEq(before - bob.balance, q);
        assertEq(address(treasury).balance, (q * 20) / 10_000);
        vrf.fulfill(req, 0);
    }

    function test_PackReservationPreventsOversell() public {
        (uint256 poolId,,,) = _setupPool();
        vm.startPrank(bob);
        usdt.approve(address(packs), type(uint256).max);
        packs.open(poolId, address(usdt));
        packs.open(poolId, address(usdt));
        packs.open(poolId, address(usdt));
        vm.expectRevert(PackMachine.PoolEmpty.selector);
        packs.open(poolId, address(usdt));
        vm.stopPrank();
    }

    function test_OnlyCoordinatorFulfills() public {
        (uint256 poolId,,,) = _setupPool();
        vm.startPrank(bob);
        usdt.approve(address(packs), 100e18);
        uint256 req = packs.open(poolId, address(usdt));
        uint256[] memory w = new uint256[](1);
        vm.expectRevert(PackMachine.OnlyCoordinator.selector);
        packs.rawFulfillRandomWords(req, w);
        vm.stopPrank();
    }

    function test_SellBack85() public {
        (uint256 poolId, uint256 a,,) = _setupPool();
        bytes32[] memory ids = new bytes32[](1);
        uint256[] memory ps = new uint256[](1);
        ids[0] = "A";
        ps[0] = 200e18;
        vm.prank(oracle);
        index.setPrices(ids, ps);
        vm.startPrank(owner);
        usdt.approve(address(packs), 1000e18);
        packs.fundSellbackReserve(1000e18);
        vm.stopPrank();

        vm.startPrank(bob);
        usdt.approve(address(packs), 100e18);
        uint256 req = packs.open(poolId, address(usdt));
        vm.stopPrank();
        vrf.fulfill(req, 0); // card A
        assertEq(vault.ownerOf(a), bob);
        assertEq(packs.sellbackQuote(a), 170e18);

        uint256 before = usdt.balanceOf(bob);
        uint256 tBefore = usdt.balanceOf(address(treasury));
        vm.startPrank(bob);
        vault.approve(address(packs), a);
        packs.sellBack(a);
        vm.stopPrank();
        assertEq(usdt.balanceOf(bob) - before, 170e18 - 0.34e18);
        assertEq(usdt.balanceOf(address(treasury)) - tBefore, 0.34e18);
        assertEq(vault.ownerOf(a), owner);
        assertEq(packs.sellbackReserve(), 830e18);

        vm.prank(bob);
        vm.expectRevert(PackMachine.SellbackClosed.selector);
        packs.sellBack(a);
    }

    function test_SellBackWindowExpires() public {
        (uint256 poolId, uint256 a,,) = _setupPool();
        vm.startPrank(bob);
        usdt.approve(address(packs), 100e18);
        uint256 req = packs.open(poolId, address(usdt));
        vm.stopPrank();
        vrf.fulfill(req, 0);
        vm.warp(block.timestamp + 2 hours);
        vm.prank(bob);
        vm.expectRevert(PackMachine.SellbackClosed.selector);
        packs.sellBack(a);
    }

    function test_PacksPausedAndFeatureOff() public {
        (uint256 poolId,,,) = _setupPool();
        vm.prank(owner);
        cfg.setPaused(true);
        vm.prank(bob);
        vm.expectRevert(CataPayments.Paused.selector);
        packs.open(poolId, address(usdt));
        vm.startPrank(owner);
        cfg.setPaused(false);
        cfg.setFeature(Features.PACKS, false);
        vm.stopPrank();
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(CataPayments.FeatureDisabled.selector, Features.PACKS));
        packs.open(poolId, address(usdt));
    }

    // ---------------------------------------------------------- gifts

    function test_GiftPackClaim() public {
        (uint256 poolId,,,) = _setupPool();
        (address signer, uint256 pk) = makeAddrAndKey("giftlink");
        vm.startPrank(alice);
        usdt.approve(address(giftPacks), 100e18);
        uint256 gid = giftPacks.buyGift(poolId, address(usdt), signer);
        vm.stopPrank();

        // wrong recipient binding fails
        bytes32 d = giftPacks.claimDigest(gid, bob);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, d);
        bytes memory sig = abi.encodePacked(r, s, v);
        address eve = makeAddr("eve");
        vm.prank(eve);
        vm.expectRevert(GiftPacks.BadSigner.selector);
        giftPacks.claim(gid, eve, sig);

        vm.prank(eve); // anyone may relay, card goes to bob
        uint256 req = giftPacks.claim(gid, bob, sig);
        vrf.fulfill(req, 1);
        assertEq(vault.balanceOf(bob), 1);
        vm.expectRevert(GiftPacks.GiftDone.selector);
        giftPacks.claim(gid, bob, sig);
    }

    function test_GiftPackBnbRefundAndReclaim() public {
        (uint256 poolId,,,) = _setupPool();
        uint256 q = packs.quote(poolId, address(0));
        uint256 before = alice.balance;
        vm.prank(alice);
        uint256 gid = giftPacks.buyGift{value: 1 ether}(poolId, address(0), address(0xBEEF));
        assertEq(before - alice.balance, q);
        vm.prank(alice);
        giftPacks.reclaim(gid);
        uint256 creditId = giftPacks.gifts(gid).creditId;
        vm.prank(alice);
        uint256 req = packs.openCredit(creditId, alice);
        vrf.fulfill(req, 0);
    }

    // ---------------------------------------------------------- sets

    function test_SetRewards() public {
        bytes32[] memory cids = new bytes32[](2);
        cids[0] = "X";
        cids[1] = "Y";
        vm.prank(owner);
        uint256 sid = sets.createSet("starter", cids, 500);
        uint256 x = _mint(alice, "X", true);
        uint256 y = _mint(alice, "Y", true);
        uint256[] memory t = new uint256[](2);
        t[0] = x;
        t[1] = y;
        vm.prank(alice);
        sets.claimSet(sid, t);
        assertEq(points.points(alice), 500);
        vm.prank(alice);
        vm.expectRevert(SetRewards.AlreadyClaimed.selector);
        sets.claimSet(sid, t);
        // move cards to bob: tokens can't be reused
        vm.startPrank(alice);
        vault.transferFrom(alice, bob, x);
        vault.transferFrom(alice, bob, y);
        vm.stopPrank();
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(SetRewards.TokenAlreadyUsed.selector, x));
        sets.claimSet(sid, t);
    }

    function test_PointsConvertAfterActivation() public {
        vm.prank(owner);
        points.award(alice, 100);
        vm.prank(owner);
        points.setRate(1e18);
        vm.prank(alice);
        vm.expectRevert(CataPoints.CataNotActive.selector);
        points.convert(100);
        vm.prank(owner);
        cfg.activateCata(address(cata));
        cata.mint(address(points), 1000e18);
        vm.prank(alice);
        uint256 net = points.convert(100);
        assertEq(net, 99.8e18);
        assertEq(cata.balanceOf(alice), 99.8e18);
        assertEq(cata.balanceOf(address(treasury)), 0.2e18);
    }

    // ---------------------------------------------------------- treasury

    function test_BuybackRequiresActivation() public {
        vm.deal(address(treasury), 1 ether);
        vm.prank(owner);
        vm.expectRevert(CataTreasury.CataNotActive.selector);
        treasury.buyback(address(0), 1 ether, 0);
    }

    function test_BuybackBnbUsdtAndCataBurn() public {
        vm.prank(owner);
        cfg.activateCata(address(cata));
        cata.mint(address(router), 1e30);
        vm.deal(address(treasury), 1 ether);
        usdt.mint(address(treasury), 10e18);
        cata.mint(address(treasury), 5e18);

        vm.prank(alice);
        vm.expectRevert(CataTreasury.NotAuthorized.selector);
        treasury.buyback(address(0), 1 ether, 0);

        vm.prank(owner);
        treasury.setKeeper(bob, true);
        vm.prank(bob);
        treasury.buyback(address(0), 1 ether, 1000 ether);
        assertEq(cata.balanceOf(DEAD), 1000 ether);

        vm.prank(bob);
        treasury.buyback(address(usdt), 10e18, 0);
        assertEq(cata.balanceOf(DEAD), 1000 ether + 10_000e18);
        assertEq(usdt.balanceOf(address(treasury)), 0);

        vm.prank(bob);
        treasury.burnCata();
        assertEq(cata.balanceOf(DEAD), 1000 ether + 10_000e18 + 5e18);
    }

    function test_BuybackRewardsSplit() public {
        vm.startPrank(owner);
        cfg.activateCata(address(cata));
        treasury.setRewardsRoute(address(points), 1000); // 10%
        vm.stopPrank();
        cata.mint(address(router), 1e30);
        vm.deal(address(treasury), 1 ether);
        vm.prank(owner);
        treasury.buyback(address(0), 1 ether, 0);
        assertEq(cata.balanceOf(DEAD), 900 ether);
        assertEq(cata.balanceOf(address(points)), 100 ether);
    }
}
