/**
 * Standalone long-running process: ends past-due giveaways every 60 seconds.
 * Run alongside the app: npm run worker:expire
 */
import "dotenv/config";
import { startGiveawayExpiryScheduler } from "../lib/giveaway-expiry-scheduler";

startGiveawayExpiryScheduler();

process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));
