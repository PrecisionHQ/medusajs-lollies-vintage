import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261015000001 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "affiliate_creator" ("id" text not null, "name" text not null, "handle" text not null, "platform" text not null default 'instagram', "commission_pct" integer not null default 10, "code" text null, "status" text not null default 'active', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "affiliate_creator_pkey" primary key ("id"));`);
    this.addSql(`alter table if exists "affiliate_creator" add constraint "affiliate_creator_handle_unique" unique ("handle");`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_affiliate_creator_deleted_at" ON "affiliate_creator" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "affiliate_creator" cascade;`);
  }

}
