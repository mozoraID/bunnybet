// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, console2}           from "forge-std/Test.sol";
import {PredictionMarketFactory}  from "../src/PredictionMarketFactory.sol";
import {PredictionMarket}         from "../src/PredictionMarket.sol";
import {MockUSDM}                 from "../src/mocks/MockUSDM.sol";

contract PredictionMarketTest is Test {
    PredictionMarketFactory factory;
    PredictionMarket        market;
    MockUSDM                usdm;

    address admin    = makeAddr("admin");     // owner + feeRecipient
    address creator  = makeAddr("creator");
    address alice    = makeAddr("alice");
    address bob      = makeAddr("bob");
    address carol    = makeAddr("carol");

    uint256 constant FEE_BPS   = 200;    // 2 %
    uint256 constant MINT      = 100_000e18;
    uint256 constant END_IN    = 7 days;
    uint256 endTime;

    function setUp() public {
        usdm = new MockUSDM();

        vm.prank(admin);
        factory = new PredictionMarketFactory(address(usdm), admin, FEE_BPS);

        endTime = block.timestamp + END_IN;

        vm.prank(creator);
        address mAddr = factory.createMarket(
            "Will BTC hit $200k by end of 2025?",
            "Resolves YES if BTC/USD >= $200 000 at any time before Dec 31 2025.",
            "", "Crypto", endTime
        );
        market = PredictionMarket(mAddr);

        for (address u : [alice, bob, carol, creator]) {
            usdm.mint(u, MINT);
            vm.prank(u);
            usdm.approve(address(market), type(uint256).max);
        }
    }

    // ── Deployment ────────────────────────────────────────────────────────────
    function test_deployment() public view {
        assertEq(address(factory.usdm()),    address(usdm));
        assertEq(factory.feeRecipient(),     admin);
        assertEq(factory.platformFeeBps(),   FEE_BPS);
        assertEq(factory.marketCount(),      1);
        assertEq(market.creator(),           creator);
        assertEq(market.platformFeeBps(),    FEE_BPS);
        assertEq(market.feeRecipient(),      admin);
        assertFalse(market.resolved());
        assertFalse(market.cancelled());
    }

    // ── Buy ───────────────────────────────────────────────────────────────────
    function test_buyYes_poolAndFees() public {
        uint256 bet = 100e18;
        uint256 adminBefore = usdm.balanceOf(admin);
        vm.prank(alice);
        market.buyYes(bet);

        uint256 pFee    = (bet * FEE_BPS) / 10_000;          // 2 USDM
        uint256 cFee    = (bet * 100) / 10_000;               // 1 USDM
        uint256 net     = bet - pFee - cFee;                   // 97 USDM

        assertEq(market.yesPool(),             net);
        assertEq(market.yesShares(alice),      net);
        assertEq(market.creatorFeesAccrued(), cFee);
        // Platform fee sent directly to feeRecipient
        assertEq(usdm.balanceOf(admin),        adminBefore + pFee);
    }

    function test_buyNo_poolAndFees() public {
        uint256 bet = 200e18;
        vm.prank(bob);
        market.buyNo(bet);

        uint256 net = bet - (bet * (FEE_BPS + 100)) / 10_000;
        assertEq(market.noPool(),        net);
        assertEq(market.noShares(bob),   net);
    }

    function test_below_min_reverts() public {
        vm.prank(alice);
        vm.expectRevert("PM: below min bet");
        market.buyYes(0.5e18);
    }

    function test_buy_after_expiry_reverts() public {
        vm.warp(endTime + 1);
        vm.prank(alice);
        vm.expectRevert("PM: expired");
        market.buyYes(100e18);
    }

    // ── Probability ───────────────────────────────────────────────────────────
    function test_prob_3_to_1() public {
        vm.prank(alice); market.buyYes(300e18);
        vm.prank(bob);   market.buyNo(100e18);
        (, , , uint256 yp, uint256 np, , , , , , ) = market.getMarketInfo();
        assertEq(yp, 7500);
        assertEq(np, 2500);
    }

    // ── Resolve ───────────────────────────────────────────────────────────────
    function test_creator_resolves_after_end() public {
        vm.warp(endTime + 1);
        vm.prank(creator);
        market.resolve(true);
        assertTrue(market.resolved());
        assertTrue(market.outcome());
    }

    function test_creator_cannot_resolve_before_end() public {
        vm.prank(creator);
        vm.expectRevert("PM: not ended");
        market.resolve(true);
    }

    function test_admin_can_force_resolve() public {
        // Factory owner can resolve anytime via resolveMarket(id, outcome)
        vm.prank(admin);
        factory.resolveMarket(0, false);
        assertTrue(market.resolved());
        assertFalse(market.outcome());
    }

    function test_random_cannot_resolve() public {
        vm.warp(endTime + 1);
        vm.prank(alice);
        vm.expectRevert("PM: not authorized");
        market.resolve(true);
    }

    // ── Redeem ────────────────────────────────────────────────────────────────
    function test_winner_gets_pool() public {
        vm.prank(alice); market.buyYes(300e18);
        vm.prank(bob);   market.buyNo(100e18);

        vm.warp(endTime + 1);
        vm.prank(creator); market.resolve(true);

        uint256 total  = market.yesPool() + market.noPool();
        uint256 before = usdm.balanceOf(alice);
        vm.prank(alice); market.redeem();
        assertEq(usdm.balanceOf(alice), before + total);
    }

    function test_loser_cannot_redeem() public {
        vm.prank(alice); market.buyYes(100e18);
        vm.prank(bob);   market.buyNo(100e18);
        vm.warp(endTime + 1);
        vm.prank(creator); market.resolve(true);

        vm.prank(bob);
        vm.expectRevert("PM: no winning shares");
        market.redeem();
    }

    function test_pro_rata() public {
        vm.prank(alice); market.buyYes(300e18);
        vm.prank(carol); market.buyYes(100e18);
        vm.prank(bob);   market.buyNo(200e18);
        vm.warp(endTime + 1);
        vm.prank(creator); market.resolve(true);

        uint256 ab = usdm.balanceOf(alice);
        uint256 cb = usdm.balanceOf(carol);
        vm.prank(alice); market.redeem();
        vm.prank(carol); market.redeem();
        assertApproxEqRel(usdm.balanceOf(alice) - ab, (usdm.balanceOf(carol) - cb) * 3, 1e15);
    }

    // ── Creator fees ──────────────────────────────────────────────────────────
    function test_creator_fee_withdrawal() public {
        vm.prank(alice); market.buyYes(1000e18);
        uint256 expected = (1000e18 * 100) / 10_000;
        uint256 before   = usdm.balanceOf(creator);
        vm.prank(creator); market.withdrawCreatorFees();
        assertEq(usdm.balanceOf(creator), before + expected);
        assertEq(market.creatorFeesAccrued(), 0);
    }

    // ── Admin: setPlatformFee ─────────────────────────────────────────────────
    function test_setPlatformFee() public {
        vm.prank(admin);
        factory.setPlatformFee(300);
        assertEq(factory.platformFeeBps(), 300);
    }

    function test_setPlatformFee_too_high_reverts() public {
        vm.prank(admin);
        vm.expectRevert("Factory: fee too high");
        factory.setPlatformFee(1_001);
    }

    function test_setPlatformFee_only_owner() public {
        vm.prank(alice);
        vm.expectRevert();
        factory.setPlatformFee(100);
    }

    // ── Admin: updateFeeRecipient ─────────────────────────────────────────────
    function test_updateFeeRecipient() public {
        address newRecip = makeAddr("newRecip");
        vm.prank(admin);
        factory.updateFeeRecipient(newRecip);
        assertEq(factory.feeRecipient(), newRecip);
    }

    // ── Admin: pause / unpause factory ───────────────────────────────────────
    function test_pause_blocks_createMarket() public {
        vm.prank(admin); factory.pause();
        vm.prank(creator);
        vm.expectRevert();
        factory.createMarket("Q?", "desc", "", "Crypto", block.timestamp + 1 days);
    }

    function test_unpause_allows_createMarket() public {
        vm.prank(admin); factory.pause();
        vm.prank(admin); factory.unpause();
        vm.prank(creator);
        factory.createMarket("Q?", "desc", "", "Crypto", block.timestamp + 1 days);
        assertEq(factory.marketCount(), 2);
    }

    // ── Admin: pause individual market ────────────────────────────────────────
    function test_pause_market_blocks_trading() public {
        vm.prank(admin); factory.pauseMarket(0);
        vm.prank(alice);
        vm.expectRevert();
        market.buyYes(100e18);
    }

    function test_unpause_market_resumes_trading() public {
        vm.prank(admin); factory.pauseMarket(0);
        vm.prank(admin); factory.unpauseMarket(0);
        vm.prank(alice); market.buyYes(100e18);
        assertTrue(market.yesPool() > 0);
    }

    // ── Admin: cancel + refund ────────────────────────────────────────────────
    function test_cancel_and_refund() public {
        uint256 bet = 100e18;
        vm.prank(alice); market.buyYes(bet);

        vm.prank(admin); factory.cancelMarket(0);
        assertTrue(market.cancelled());

        uint256 net    = bet - (bet * (FEE_BPS + 100)) / 10_000;
        uint256 before = usdm.balanceOf(alice);
        vm.prank(alice); market.claimRefund();
        assertEq(usdm.balanceOf(alice), before + net);
    }

    // ── Admin: withdrawFees (factory sweep) ───────────────────────────────────
    function test_withdrawFees_sweeps_factory() public {
        // Simulate USDM accidentally sent to factory
        usdm.mint(address(factory), 500e18);
        uint256 before = usdm.balanceOf(admin);
        vm.prank(admin); factory.withdrawFees();
        assertEq(usdm.balanceOf(admin), before + 500e18);
        assertEq(usdm.balanceOf(address(factory)), 0);
    }

    // ── getConfig ─────────────────────────────────────────────────────────────
    function test_getConfig() public view {
        (address u, address fr, uint256 fee, uint256 cnt, bool p) = factory.getConfig();
        assertEq(u,   address(usdm));
        assertEq(fr,  admin);
        assertEq(fee, FEE_BPS);
        assertEq(cnt, 1);
        assertFalse(p);
    }

    // ── Fuzz ──────────────────────────────────────────────────────────────────
    function testFuzz_buyAndRedeem(uint256 a, uint256 b) public {
        a = bound(a, 1e18, 50_000e18);
        b = bound(b, 1e18, 50_000e18);
        usdm.mint(alice, a); usdm.mint(bob, b);
        vm.prank(alice); usdm.approve(address(market), a);
        vm.prank(bob);   usdm.approve(address(market), b);

        vm.prank(alice); market.buyYes(a);
        vm.prank(bob);   market.buyNo(b);

        vm.warp(endTime + 1);
        vm.prank(creator); market.resolve(true);

        uint256 total = market.yesPool() + market.noPool();
        vm.prank(alice); market.redeem();

        // Only creator fees remain in contract
        assertEq(usdm.balanceOf(address(market)), market.creatorFeesAccrued());
    }
}