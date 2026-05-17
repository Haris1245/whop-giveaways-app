ALTER TABLE "giveaway" DROP COLUMN IF EXISTS "reward_amount";--> statement-breakpoint
ALTER TABLE "giveaway" DROP COLUMN IF EXISTS "reward_type";--> statement-breakpoint
DROP TYPE IF EXISTS "reward_type";
