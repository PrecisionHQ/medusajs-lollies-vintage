import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261010130239 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "review" ("id" text not null, "product_id" text not null, "customer_id" text null, "name" text not null, "rating" integer not null, "title" text null, "body" text not null, "status" text not null default 'pending', "verified" boolean not null default false, "helpful_count" integer not null default 0, "locale" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "review_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_review_deleted_at" ON "review" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "review" cascade;`);
  }

}
