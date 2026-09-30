ALTER TABLE "products" ADD COLUMN "restocks" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "watches" ADD COLUMN "notify_on_restock" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "watches" ADD COLUMN "last_restock_notified_at" timestamp with time zone;