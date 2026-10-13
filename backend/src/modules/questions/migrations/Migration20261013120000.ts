import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261013120000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "question" ("id" text not null, "product_id" text not null, "customer_id" text null, "name" text not null, "email" text not null, "question" text not null, "answer" text null, "status" text not null default 'open', "locale" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "question_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_question_deleted_at" ON "question" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "question" cascade;`);
  }

}
