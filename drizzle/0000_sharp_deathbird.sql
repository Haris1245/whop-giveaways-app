CREATE TYPE "public"."giveaway_status" AS ENUM('active', 'drawing', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."reward_type" AS ENUM('text', 'money');--> statement-breakpoint
CREATE TABLE "entrant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"giveaway_id" uuid NOT NULL,
	"user_id" varchar NOT NULL,
	"username" varchar NOT NULL,
	"ip_address" varchar,
	"hardware_fingerprint" varchar,
	"whop_account_created_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "giveaway" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"experience_id" varchar NOT NULL,
	"company_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"reward_type" "reward_type" NOT NULL,
	"reward_amount" integer DEFAULT 0,
	"reward_text" text,
	"required_pass_id" varchar,
	"min_account_age_days" integer DEFAULT 0,
	"status" "giveaway_status" DEFAULT 'active' NOT NULL,
	"end_time" timestamp NOT NULL,
	"winner_user_id" varchar,
	"winner_picked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"pass_id" varchar NOT NULL,
	"status" text NOT NULL,
	"membership_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "entrant" ADD CONSTRAINT "entrant_giveaway_id_giveaway_id_fk" FOREIGN KEY ("giveaway_id") REFERENCES "public"."giveaway"("id") ON DELETE cascade ON UPDATE no action;