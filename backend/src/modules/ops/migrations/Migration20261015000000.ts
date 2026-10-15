import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261015000000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "ops_heartbeat" ("id" text not null, "name" text not null, "last_ok_at" timestamptz null, "last_error" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "ops_heartbeat_pkey" primary key ("id"));`);
    this.addSql(`alter table if exists "ops_heartbeat" add constraint "ops_heartbeat_name_unique" unique ("name");`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_ops_heartbeat_deleted_at" ON "ops_heartbeat" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "ops_heartbeat" cascade;`);
  }

}
