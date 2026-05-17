ALTER TABLE "giveaway" ADD COLUMN "enforce_ip_checks" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "giveaway" ADD COLUMN "enforce_account_age" boolean DEFAULT false NOT NULL;