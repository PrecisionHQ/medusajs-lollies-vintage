import { defineMiddlewares } from "@medusajs/framework/http";

/**
 * Phase 5 (R1) — enforcement wiring for shop-built admin routes. Core
 * routes (orders, products, promotions, …) already declare policies in
 * Medusa middlewares; this file covers ours. Convention: GET → read,
 * creation POSTs → create, mutation POSTs → update, DELETE → delete.
 *
 * SHOP_ROUTE_POLICIES is exported pure so the unit test can prove every
 * custom admin route file has a covering matcher (a future route shipping
 * unguarded fails the build, not the audit).
 *
 * Deliberately untouched: /admin/promotions/* (core guards it, including
 * our exclusions route), /admin/sales-channels/* (core), store routes
 * (publishable-key/customer auth, not admin policies), /api/key-exchange
 * (deliberately unauthenticated — publishable keys are public).
 */

type Entry = {
  matcher: string;
  methods: ("GET" | "POST" | "PUT" | "PATCH" | "DELETE")[];
  policies: { resource: string; operation: string }[];
};

const R = (resource: string, operation: string) => ({ resource, operation });

export const SHOP_ROUTE_POLICIES: Entry[] = [
  { matcher: "/admin/phone/*", methods: ["GET"], policies: [R("phone", "read")] },
  { matcher: "/admin/ops/*", methods: ["GET"], policies: [R("ops", "read")] },
  { matcher: "/admin/push/subscriptions", methods: ["GET"], policies: [R("push", "read")] },
  { matcher: "/admin/push/send", methods: ["POST"], policies: [R("push", "update")] },
  { matcher: "/admin/push/bind", methods: ["POST"], policies: [R("push", "update")] },
  { matcher: "/admin/questions", methods: ["GET"], policies: [R("question", "read")] },
  { matcher: "/admin/questions/*", methods: ["POST"], policies: [R("question", "update")] },
  { matcher: "/admin/reviews", methods: ["GET"], policies: [R("review", "read")] },
  { matcher: "/admin/reviews/*", methods: ["POST"], policies: [R("review", "update")] },
  { matcher: "/admin/marketing/flows", methods: ["GET"], policies: [R("marketing", "read")] },
  { matcher: "/admin/marketing/flows", methods: ["POST"], policies: [R("marketing", "update")] },
  { matcher: "/admin/marketing/campaigns", methods: ["GET"], policies: [R("marketing", "read")] },
  { matcher: "/admin/marketing/campaigns", methods: ["POST"], policies: [R("marketing", "create")] },
  { matcher: "/admin/marketing/campaigns/*", methods: ["GET"], policies: [R("marketing", "read")] },
  { matcher: "/admin/marketing/campaigns/*", methods: ["POST"], policies: [R("marketing", "update")] },
  { matcher: "/admin/marketing/spend", methods: ["GET"], policies: [R("marketing", "read")] },
  { matcher: "/admin/marketing/spend", methods: ["POST"], policies: [R("marketing", "create")] },
  { matcher: "/admin/marketing/spend/*", methods: ["DELETE"], policies: [R("marketing", "delete")] },
  { matcher: "/admin/marketing/roas", methods: ["GET"], policies: [R("marketing", "read")] },
  { matcher: "/admin/affiliates", methods: ["GET"], policies: [R("affiliate", "read")] },
  { matcher: "/admin/affiliates", methods: ["POST"], policies: [R("affiliate", "create")] },
  { matcher: "/admin/affiliates/*", methods: ["GET", "POST"], policies: [R("affiliate", "update")] },
  { matcher: "/admin/affiliates/*", methods: ["DELETE"], policies: [R("affiliate", "delete")] },
  { matcher: "/admin/loyalty", methods: ["GET"], policies: [R("loyalty", "read")] },
  { matcher: "/admin/loyalty", methods: ["POST"], policies: [R("loyalty", "update")] },
  { matcher: "/admin/loyalty/*", methods: ["GET"], policies: [R("loyalty", "read")] },
  { matcher: "/admin/bundles", methods: ["GET"], policies: [R("bundle", "read")] },
  { matcher: "/admin/bundles", methods: ["POST"], policies: [R("bundle", "create")] },
  { matcher: "/admin/bundles/*", methods: ["POST"], policies: [R("bundle", "update")] },
  { matcher: "/admin/bundles/*", methods: ["DELETE"], policies: [R("bundle", "delete")] },
  { matcher: "/admin/redirects", methods: ["GET"], policies: [R("redirect", "read")] },
  { matcher: "/admin/redirects", methods: ["POST"], policies: [R("redirect", "create")] },
  { matcher: "/admin/redirects/*", methods: ["POST"], policies: [R("redirect", "update")] },
  { matcher: "/admin/redirects/*", methods: ["DELETE"], policies: [R("redirect", "delete")] },
  { matcher: "/admin/shipping", methods: ["GET"], policies: [R("shipping", "read")] },
  { matcher: "/admin/shipping", methods: ["POST"], policies: [R("shipping", "create")] },
  { matcher: "/admin/shipping/*", methods: ["DELETE"], policies: [R("shipping", "delete")] },
  { matcher: "/admin/preorders", methods: ["GET"], policies: [R("product", "read")] },
  { matcher: "/admin/preorders", methods: ["POST"], policies: [R("product", "update")] },
  { matcher: "/admin/pricing", methods: ["GET"], policies: [R("product", "read")] },
  { matcher: "/admin/pricing", methods: ["POST"], policies: [R("product", "update")] },
  { matcher: "/admin/pricing/*", methods: ["GET", "POST"], policies: [R("product", "update")] },
  { matcher: "/admin/analytics/*", methods: ["GET"], policies: [R("order", "read")] },
  { matcher: "/admin/payments/overview", methods: ["GET"], policies: [R("payment", "read")] },
  { matcher: "/admin/wishlists", methods: ["GET"], policies: [R("wishlist", "read")] },
  { matcher: "/admin/wishlists/*", methods: ["GET"], policies: [R("wishlist", "read")] },
];

export default defineMiddlewares(
  SHOP_ROUTE_POLICIES.map((e) => ({
    matcher: e.matcher,
    methods: e.methods,
    policies: e.policies,
  }))
);
