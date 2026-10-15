import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261015000002 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "affiliate_hit" ("id" text not null, "handle" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "affiliate_hit_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_affiliate_hit_deleted_at" ON "affiliate_hit" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "affiliate_hit" cascade;`);
  }

}
