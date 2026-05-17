import { integer, pgTable, timestamp, varchar, text, uuid, pgEnum, boolean, uniqueIndex } from "drizzle-orm/pg-core";

// Enums for rigid, safe data handling
export const giveawayStatusEnum = pgEnum("giveaway_status", ["active", "drawing", "completed", "cancelled"]);

// 1. THE MAIN GIVEAWAY TABLE
export const giveawayTable = pgTable("giveaway", {
   id: uuid("id").primaryKey().defaultRandom(),
   experienceId: varchar("experience_id").notNull(), // Links to the specific Whop app instance
   companyId: varchar("company_id").notNull(),       // The creator/seller company ID
   title: text("title").notNull(),
   description: text("description").notNull(),
   coverImageUrl: text("cover_image_url"),
   rewardText: text("reward_text"),                   // Prize description (required at create)

   requiredPassId: varchar("required_pass_id"),       // Whop Pass ID required to enter (null = free for all)
   minAccountAgeDays: integer("min_account_age_days").default(0), // Used when enforceAccountAge is true
   /** When true, entry flow should validate duplicate IPs / IP-based abuse rules */
   enforceIpChecks: boolean("enforce_ip_checks").default(false).notNull(),
   /** When true, entry flow must enforce minAccountAgeDays against the Whop account */
   enforceAccountAge: boolean("enforce_account_age").default(false).notNull(),
   
   status: giveawayStatusEnum("status").default("active").notNull(),
   endTime: timestamp("end_time").notNull(),          // When the cron job should draw the winner
   
   winnerUserId: varchar("winner_user_id"),           // Populated via API once drawn
   winnerPickedAt: timestamp("winner_picked_at"),
   
   createdAt: timestamp("created_at").defaultNow().notNull(),
   updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 2. THE ENTRANTS TABLE (Tracks who joined and powers Anti-Cheat)
export const entrantTable = pgTable("entrant", {
   id: uuid("id").primaryKey().defaultRandom(),
   giveawayId: uuid("giveaway_id").references(() => giveawayTable.id, { onDelete: "cascade" }).notNull(),
   userId: varchar("user_id").notNull(),              // The entrant's Whop user ID
   username: varchar("username").notNull(),          // Cached for easy rendering on winner boards
   ipAddress: varchar("ip_address"),                  // Logged to catch multi-accounting
   hardwareFingerprint: varchar("hardware_fingerprint"), // Optional hash if you pass client-side canvas fingerprints
   whopAccountCreatedAt: timestamp("whop_account_created_at"), // Saved during entry API call to double-check age rules
   createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
   giveawayUserUnique: uniqueIndex("entrant_giveaway_user_unique").on(
      table.giveawayId,
      table.userId,
   ),
}));

// 3. WHOP SUBSCRIPTIONS TABLE (Your boilerplate tracker for members' billing)
export const subscriptionTable = pgTable("subscription", {
   id: uuid("id").primaryKey().defaultRandom(),
   companyId: varchar("company_id").notNull(),
   userId: varchar("user_id").notNull(),
   passId: varchar("pass_id").notNull(),
   status: text("status").notNull(),
   membershipId: text("membership_id").notNull(),
   createdAt: timestamp("created_at").defaultNow().notNull(),
   updatedAt: timestamp("updated_at").defaultNow().notNull(),
});