import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261010130241 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "bundle" ("id" text not null, "promotion_id" text not null, "name" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "bundle_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_bundle_deleted_at" ON "bundle" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "bundle_component" ("id" text not null, "bundle_id" text not null, "variant_id" text not null, "quantity" integer not null default 1, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "bundle_component_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_bundle_component_deleted_at" ON "bundle_component" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "bundle" cascade;`);

    this.addSql(`drop table if exists "bundle_component" cascade;`);
  }

}
