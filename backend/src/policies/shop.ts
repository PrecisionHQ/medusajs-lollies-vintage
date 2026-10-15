import { definePolicies } from "@medusajs/framework/utils";

/**
 * Phase 5 (R1) — custom-resource policies for every shop-built admin
 * route. Core entities (order, product, …) already declare their own
 * policies in Medusa middlewares; these cover the modules core doesn't
 * know: question, review, marketing, push, ops, affiliate, loyalty, phone,
 * redirect, bundle, shipping, wishlist.
 *
 * Registered automatically at boot (src/policies discovery); enforced in
 * src/api/middlewares.ts per route. With the rbac flag OFF everything
 * stays open (current behavior); flipping MEDUSA_FF_RBAC=true activates
 * all of it at once — see docs/staff-roles.md runbook.
 */

const RESOURCES = [
  "question",
  "review",
  "marketing",
  "push",
  "ops",
  "affiliate",
  "loyalty",
  "phone",
  "redirect",
  "bundle",
  "shipping",
  "wishlist",
] as const;

const OPERATIONS = ["read", "create", "update", "delete"] as const;

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export const shopPolicies = definePolicies(
  RESOURCES.flatMap((resource) =>
    OPERATIONS.map((operation) => ({
      name: `${cap(operation)}${cap(resource)}`,
      resource,
      operation,
      description: `${cap(operation)} ${resource} (shop custom routes)`,
    }))
  )
);

export const SHOP_RESOURCES = RESOURCES as readonly string[];
