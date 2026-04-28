// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2}          from "forge-std/Script.sol";
import {PredictionMarketFactory}   from "../src/PredictionMarketFactory.sol";

/**
 * @title  Deploy — BunnyBet on MegaETH Mainnet
 *
 * ─── Commands ────────────────────────────────────────────────────────────────
 *
 * Dry-run:
 *   forge script script/Deploy.s.sol --rpc-url $MEGAETH_RPC_URL -vvvv
 *
 * Live deploy + verify (Blockscout — recommended):
 *   forge script script/Deploy.s.sol \
 *     --rpc-url $MEGAETH_RPC_URL \
 *     --broadcast \
 *     --verify \
 *     --verifier blockscout \
 *     --verifier-url https://megaeth.blockscout.com/api \
 *     -vvvv
 *
 * Live deploy + verify (mega.etherscan.io — alternative):
 *   forge script script/Deploy.s.sol \
 *     --rpc-url $MEGAETH_RPC_URL \
 *     --broadcast \
 *     --verify \
 *     --verifier-url https://mega.etherscan.io/api \
 *     --etherscan-api-key $ETHERSCAN_API_KEY \
 *     -vvvv
 */
contract Deploy is Script {
    // ── Hardcoded addresses for BunnyBet ──────────────────────────────────────
    address constant USDM          = 0xFAfDdbb3FC7688494971a79cc65DCa3EF82079E7;
    address constant FEE_RECIPIENT = 0xD3E17d9BC3F3A038382c19fFB8b52BABeCf2E494;
    uint256 constant PLATFORM_FEE  = 200; // 2 %

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer    = vm.addr(deployerKey);

        console2.log("=== BunnyBet Deployment ===");
        console2.log("Chain ID        :", block.chainid);
        console2.log("Deployer        :", deployer);
        console2.log("USDM            :", USDM);
        console2.log("Fee Recipient   :", FEE_RECIPIENT);
        console2.log("Platform Fee    :", PLATFORM_FEE, "bps (2%)");

        vm.startBroadcast(deployerKey);

        PredictionMarketFactory factory = new PredictionMarketFactory(
            USDM,
            FEE_RECIPIENT,
            PLATFORM_FEE
        );

        // Transfer ownership to admin wallet
        // (deployer == admin here, but explicit in case you use a separate deployer key)
        if (deployer != FEE_RECIPIENT) {
            factory.transferOwnership(FEE_RECIPIENT);
            console2.log("Ownership transferred to:", FEE_RECIPIENT);
        }

        // Seed a demo market (optional)
        bool seed = false;
        try vm.envBool("SEED_MARKET") returns (bool s) { seed = s; } catch {}

        if (seed) {
            // Re-acquire factory if ownership transferred — use deployer key which still works before renounce
            address demo = factory.createMarket(
                "Will MegaETH reach $1B TVL by end of Q2 2026?",
                "Resolves YES if DeFiLlama reports MegaETH TVL >= $1 000 000 000 USD "
                "at any point before June 30 2026 23:59 UTC.",
                "https://megaeth.com/og.png",
                "Crypto",
                block.timestamp + 90 days
            );
            console2.log("Demo market     :", demo, "(ID: 0)");
        }

        vm.stopBroadcast();

        console2.log("\n=== Done ===");
        console2.log("Factory         :", address(factory));
        console2.log("Owner           :", factory.owner());
        console2.log("\n→ Set in frontend .env.local:");
        console2.log("  NEXT_PUBLIC_FACTORY_ADDRESS=", address(factory));
        console2.log("  NEXT_PUBLIC_USDM_ADDRESS=", USDM);
    }
}
