import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261010130238 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "not_found_log" ("id" text not null, "path" text not null, "hits" integer not null default 1, "last_seen" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "not_found_log_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_not_found_log_deleted_at" ON "not_found_log" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "redirect" ("id" text not null, "from_path" text not null, "to_path" text not null, "status_code" integer not null default 301, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "redirect_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_redirect_deleted_at" ON "redirect" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "not_found_log" cascade;`);

    this.addSql(`drop table if exists "redirect" cascade;`);
  }

}
