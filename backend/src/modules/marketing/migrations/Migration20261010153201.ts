import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261010153201 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "marketing_campaign" ("id" text not null, "subject" text not null, "headline" text not null, "body" text not null, "cta_label" text not null default 'Shop now', "cta_href" text not null default '/', "product_handles" text not null default '', "status" text not null default 'draft', "scheduled_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "marketing_campaign_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_campaign_deleted_at" ON "marketing_campaign" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "marketing_campaign" cascade;`);
  }

}
