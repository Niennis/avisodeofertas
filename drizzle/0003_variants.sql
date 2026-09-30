ALTER TABLE "products" ADD COLUMN "variants" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "watches" ADD COLUMN "excluded_variants" jsonb DEFAULT '[]'::jsonb NOT NULL;