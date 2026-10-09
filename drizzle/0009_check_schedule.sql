CREATE TABLE "check_schedule" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"checks_per_day" integer DEFAULT 1 NOT NULL,
	"last_check_at" timestamp with time zone
);
--> statement-breakpoint
-- Sin microsegundos: la app compara esta fecha con la que leyó, y JavaScript solo guarda milisegundos.
INSERT INTO "check_schedule" ("id", "checks_per_day", "last_check_at") VALUES (1, 1, date_trunc('milliseconds', now()));
