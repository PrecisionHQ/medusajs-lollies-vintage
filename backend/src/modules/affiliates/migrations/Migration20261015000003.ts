import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261015000003 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "affiliate_payout" ("id" text not null, "creator_id" text not null, "amount_minor" integer not null, "currency" text not null default 'eur', "note" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "affiliate_payout_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_affiliate_payout_deleted_at" ON "affiliate_payout" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "affiliate_payout" cascade;`);
  }

}
