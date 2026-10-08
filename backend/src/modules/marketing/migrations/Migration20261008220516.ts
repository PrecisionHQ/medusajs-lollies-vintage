import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261008220516 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "marketing_flow_config" ("id" text not null, "key" text not null, "enabled" boolean not null default true, "delay_hours" integer not null default 4, "second_delay_hours" integer not null default 24, "second_enabled" boolean not null default true, "incentive_enabled" boolean not null default false, "incentive_code" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "marketing_flow_config_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_flow_config_deleted_at" ON "marketing_flow_config" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "marketing_flow_log" ("id" text not null, "flow" text not null, "reference_id" text not null, "idempotency_key" text not null, "recipient" text not null, "sent_at" timestamptz not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "marketing_flow_log_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_flow_log_deleted_at" ON "marketing_flow_log" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "marketing_newsletter_subscription" ("id" text not null, "email" text not null, "status" text not null default 'pending', "source" text null, "confirm_token" text null, "confirmed_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "marketing_newsletter_subscription_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_newsletter_subscription_deleted_at" ON "marketing_newsletter_subscription" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "marketing_opt_out" ("id" text not null, "email" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "marketing_opt_out_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_opt_out_deleted_at" ON "marketing_opt_out" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "marketing_stock_subscription" ("id" text not null, "variant_id" text not null, "product_id" text not null, "email" text not null, "customer_id" text null, "token" text not null, "notified_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "marketing_stock_subscription_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_stock_subscription_deleted_at" ON "marketing_stock_subscription" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "marketing_flow_config" cascade;`);

    this.addSql(`drop table if exists "marketing_flow_log" cascade;`);

    this.addSql(`drop table if exists "marketing_newsletter_subscription" cascade;`);

    this.addSql(`drop table if exists "marketing_opt_out" cascade;`);

    this.addSql(`drop table if exists "marketing_stock_subscription" cascade;`);
  }

}
