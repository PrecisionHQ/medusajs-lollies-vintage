import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { SHOP_ROUTE_POLICIES } from "../middlewares";

const ADMIN_API = join(__dirname, "..", "admin");

type RouteFile = { path: string; methods: string[] };

function collect(dir: string, out: RouteFile[] = []): RouteFile[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      collect(full, out);
      continue;
    }
    if (entry !== "route.ts") continue;
    const rel = full
      .slice(ADMIN_API.length)
      .replace(/\\/g, "/")
      .replace(/\/route\.ts$/, "")
      .replace(/\[([^\]]+)\]/g, "*");
    const src = readFileSync(full, "utf8");
    const methods = ["GET", "POST", "PUT", "PATCH", "DELETE"].filter((m) =>
      new RegExp(`export const ${m}\\b`).test(src)
    );
    out.push({ path: `/admin${rel || "/"}`, methods });
  }
  return out;
}

function covered(path: string, method: string): boolean {
  return SHOP_ROUTE_POLICIES.some((e) => {
    if (!e.methods.includes(method as any)) return false;
    if (e.matcher.endsWith("/*")) {
      const prefix = e.matcher.slice(0, -2);
      return path === prefix || path.startsWith(`${prefix}/`);
    }
    return e.matcher === path;
  });
}

describe("shop route policy coverage", () => {
  const routes = collect(ADMIN_API);

  it("covers every custom admin route file + method", () => {
    // Core-owned paths inherit Medusa middlewares (promotions incl. our
    // exclusions route, sales-channels, users, invites) and are excluded.
    const CORE_OWNED = ["/admin/promotions", "/admin/sales-channels", "/admin/users", "/admin/invites"];
    const gaps: string[] = [];
    for (const r of routes) {
      if (CORE_OWNED.some((p) => r.path === p || r.path.startsWith(`${p}/`))) continue;
      for (const m of r.methods) {
        if (!covered(r.path, m)) gaps.push(`${m} ${r.path}`);
      }
    }
    expect(gaps).toEqual([]);
  });

  it("has no dead matchers (every matcher hits a real route file)", () => {
    const paths = routes.map((r) => r.path);
    const dead = SHOP_ROUTE_POLICIES.filter((e) => {
      if (e.matcher.endsWith("/*")) {
        const prefix = e.matcher.slice(0, -2);
        return !paths.some((p) => p === prefix || p.startsWith(`${prefix}/`));
      }
      return !paths.includes(e.matcher);
    }).map((e) => `${e.methods.join(",")} ${e.matcher}`);
    expect(dead).toEqual([]);
  });
});
