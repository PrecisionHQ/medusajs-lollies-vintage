import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261011095543 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "marketing_ad_spend" ("id" text not null, "spend_date" text not null, "source" text not null, "campaign" text null, "amount_minor" integer not null, "currency" text not null default 'eur', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "marketing_ad_spend_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_ad_spend_deleted_at" ON "marketing_ad_spend" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "marketing_ad_spend" cascade;`);
  }

}
