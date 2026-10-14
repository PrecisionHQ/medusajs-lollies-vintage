import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261014000000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "push_subscription" ("id" text not null, "endpoint" text not null, "p256dh" text not null, "auth" text not null, "user_id" text null, "device" text not null default 'phone', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "push_subscription_pkey" primary key ("id"));`);
    this.addSql(`alter table if exists "push_subscription" add constraint "push_subscription_endpoint_unique" unique ("endpoint");`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_push_subscription_deleted_at" ON "push_subscription" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "push_subscription" cascade;`);
  }

}
