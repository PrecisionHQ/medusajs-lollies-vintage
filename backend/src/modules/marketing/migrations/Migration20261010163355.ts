import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261010163355 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "marketing_campaign_send" ("id" text not null, "campaign_id" text not null, "email" text not null, "status" text not null, "error" text null, "sent_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "marketing_campaign_send_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_campaign_send_deleted_at" ON "marketing_campaign_send" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "marketing_campaign_send" cascade;`);
  }

}
