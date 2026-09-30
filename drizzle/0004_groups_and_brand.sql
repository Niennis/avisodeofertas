CREATE TABLE "product_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "brand" text;--> statement-breakpoint
ALTER TABLE "watches" ADD COLUMN "group_id" uuid;--> statement-breakpoint
ALTER TABLE "product_groups" ADD CONSTRAINT "product_groups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_groups_user_idx" ON "product_groups" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "watches" ADD CONSTRAINT "watches_group_id_product_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."product_groups"("id") ON DELETE set null ON UPDATE no action;