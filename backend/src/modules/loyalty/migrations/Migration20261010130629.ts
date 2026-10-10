import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261010130629 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "loyalty_account" ("id" text not null, "customer_id" text not null, "balance" integer not null default 0, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "loyalty_account_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_loyalty_account_deleted_at" ON "loyalty_account" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "loyalty_ledger" ("id" text not null, "customer_id" text not null, "delta" integer not null, "reason" text not null, "order_id" text null, "expires_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "loyalty_ledger_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_loyalty_ledger_deleted_at" ON "loyalty_ledger" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "loyalty_settings" ("id" text not null, "key" text not null, "earn_per_major" integer not null default 1, "burn_threshold" integer not null default 500, "burn_value_minor" integer not null default 500, "burn_currency" text not null default 'eur', "expiry_months" integer not null default 12, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "loyalty_settings_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_loyalty_settings_deleted_at" ON "loyalty_settings" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "loyalty_account" cascade;`);

    this.addSql(`drop table if exists "loyalty_ledger" cascade;`);

    this.addSql(`drop table if exists "loyalty_settings" cascade;`);
  }

}
