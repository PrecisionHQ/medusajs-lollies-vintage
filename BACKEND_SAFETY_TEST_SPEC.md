# Backend Safety Test Specification

**Version:** 1.0
**Date:** 2026-09-27
**Scope:** All custom backend code in `medusajs-lollies-vintage/backend/`

---

## 1. Executive Summary

This document defines the complete test coverage required for the backend to be considered "safe for production." It covers:
- Unit tests (pure logic, no DB)
- Integration tests (Medusa modules, DB required)
- Contract/API tests (store & admin endpoints)
- Security/penetration tests
- Chaos/failure mode tests
- Regression tests for known bugs

---

## 2. Current Test State

| Area | Status | Tool | Coverage |
|------|--------|------|----------|
| Top-up math (`topup-math.ts`) | ✅ Unit tests exist | vitest | 100% of pure logic |
| Email notifications | ❌ No tests | - | 0% |
| Subscribers (order-placed, invite-created, password-reset) | ❌ | - | 0% |
| Payment providers (Polar, Dodo, Stripe) | ❌ | - | 0% |
| API routes (key-exchange, promotions, exclusions) | ❌ | - | 0% |
| Email templates (React) | ❌ | - | 0% |
| Search index (products.ts) | ❌ | - | 0% |
| Webhooks (Polar, Dodo, Stripe) | ❌ | - | 0% |

**Gap:** ~85% of custom code untested.

---

## 3. Test Architecture

### 3.1 Test Pyramid Target

```
         E2E (Playwright)          ← Storefront QA suite (already exists)
              ↑
       Integration Tests           ← Medusa test-utils, real Postgres
              ↑
       Unit Tests (Vitest)         ← Pure logic, no DB, ms-level
```

### 3.2 Tooling Decisions

| Layer | Tool | Rationale |
|-------|------|-----------|
| Unit | Vitest | Already configured, no DB, fast |
| Integration | `@medusajs/test-utils` + Jest/Vitest | Official Medusa testing utilities, real DB |
| E2E | Playwright (storefront) | Already configured |
| Contract | Supertest + Vitest | Fast, no browser |

### 3.3 Test Environment

| Environment | Use Case |
|-------------|----------|
| CI (GitHub Actions) | Unit tests, lint, typecheck, secrets scan |
| Local dev | Unit + integration (local Postgres) |
| Railway preview | Integration + E2E (real services) |
| Production | Smoke tests only (read-only) |

---

## 4. Test Matrix by Component

### 4.1 Core Library (`src/lib/`)

| Function | Test Type | Scenarios |
|----------|-----------|-----------|
| `topup-math.ts` | Unit (✅ Done) | Layered books, order-independence, removal, guards, non-discountable, invalid floors, duplicate normalization |
| `constants.ts` | Unit | Env parsing, fallbacks, URL building |
| `topup-math.ts` (new) | Unit | All edge cases covered |

**Missing:**
- `constants.ts` - URL building, fallback logic, currency handling

### 4.2 Subscribers (`src/subscribers/`)

| Subscriber | Events | Test Types Needed |
|------------|--------|-------------------|
| `topup-correction.ts` | `cart.updated` | Integration: correction runs after native promo, no double-apply, idempotent |
| `order-placed.ts` | `order.placed` | Integration: email sent, address fallback, digital orders (no shipping), error path |
| `invite-created.ts` | `invite.created`, `invite.resent` | Integration: email sent, link correct, admin vs shopper |
| `password-reset.ts` | `auth.password_reset` | Integration: admin vs storefront URL, token TTL, dev logging, error path |

### 4.3 Payment Providers (`src/modules/*/service.ts`)

| Provider | Methods to Test | Key Scenarios |
|----------|-----------------|---------------|
| **Polar** | `initiatePayment`, `authorizePayment`, `capturePayment`, `refundPayment`, `getPaymentStatus`, `getWebhookActionAndData` | Ad-hoc price creation, checkout URL returned, authorize verifies `succeeded`, webhook `order.paid` → CAPTURED, amount tamper guard, refund not implemented |
| **Dodo** | `initiatePayment`, `authorizePayment`, `capturePayment`, `refundPayment`, `getPaymentStatus`, `getWebhookActionAndData` | PWYW amount set correctly, `payment.succeeded` → CAPTURED, refund via payment ID, webhook signature verification |
| **Stripe** (existing) | All methods | Already tested upstream, but need regression for our wrapper |
| **Manual** (built-in) | - | No custom code |

### 4.4 API Routes

| Route | Methods | Test Scenarios |
|-------|---------|----------------|
| `GET /store/carts/:id/promotions` (override) | POST, DELETE | Sync correction inline, settled totals returned, native errors passed through |
| `GET /admin/promotions/:id/exclusions` | GET, POST | Exclusion list CRUD, `ne` rules, title resolution |
| `GET /store/carts/:id/gift-cards` | POST, DELETE | Gift card apply/remove, credit lines created/removed |
| `GET /admin/gift-cards` | GET, POST | CRUD, code generation, status transitions |
| `GET /admin/gift-cards/:id` | GET, POST, DELETE | Update expiry, delete (blocked if redeemed) |
| `GET /store/gift-cards/:code` | GET | Lookup by code, status check |
| `GET /admin/meilisearch/sync` | POST | Full reindex triggered, job ID returned |
| `GET /store/carts/:id/gift-cards` | POST, DELETE | Gift card apply/remove |
| `GET /admin/meilisearch/sync` | POST | Reindex job triggered |

### 4.5 Email System (`src/modules/email-notifications/`)

| Component | Test Type | Scenarios |
|-----------|-----------|-----------|
| `ResendNotificationService` | Unit + Integration | Send success, API error, template error, attachment handling, invalid template |
| Templates (`base.tsx`, `invite-user.tsx`, `order-placed.tsx`, `reset-password.tsx`) | Snapshot/Unit | Render with valid data, missing data throws, data shape validation |
| `generateEmailTemplate` | Unit | All 3 templates, invalid key throws, data shape guards |
| Subscribers (`order-placed`, `invite-created`, `password-reset`) | Integration | Email queued, correct template/data, error path doesn't crash workflow |

### 4.6 Search (`src/search/products.ts`)

| Feature | Test Type | Scenarios |
|---------|-----------|-----------|
| Schema extension | Unit | `variants.options.value` searchable + filterable |
| `graph_fields` extension | Integration | `variants.options.value` included in index |
| Reindex sync | Integration | `POST /admin/meilisearch/sync` triggers full reindex |

### 4.6 Security / Hardening

| Area | Test Type | Scenarios |
|------|-----------|-----------|
| Webhook signature verification | Unit + Integration | Valid signature passes, invalid fails, replay protection, timestamp tolerance |
| Secrets scanning | CI | gitleaks on PR, no false positives on placeholders |
| Input validation | Integration | SQL injection, XSS in search, oversized payloads |
| Rate limiting | Integration | Cart endpoints, payment endpoints |
| CORS | Integration | Only configured origins allowed |
| CORS wildcards | Config audit | No `*` in production |

---

## 5. Test Implementation Plan

### Phase 1: Foundation (Week 1) ✅ Partially Done
- [x] `topup-math.ts` unit tests (100% coverage)
- [x] Vitest config, CI job
- [ ] `constants.ts` unit tests
- [ ] Test utilities/helpers

### Phase 2: Pure Logic → Subscribers (Week 2)
- [ ] `topup-correction.ts` integration tests
- [ ] `order-placed.ts` subscriber
- [ ] `invite-created.ts` subscriber
- [ ] `password-reset.ts` subscriber

### Phase 3: Payment Providers (Week 3)
- [ ] Polar provider (mock `@polar-sh/sdk`)
- [ ] Dodo provider (mock `dodopayments`)
- [ ] Stripe regression (existing)
- [ ] Webhook handlers (signature verification, event routing)

### Phase 4: API Routes + Email (Week 4)
- [ ] All custom API routes
- [ ] Email service (Resend mock)
- [ ] Email templates (snapshot)
- [ ] Subscriber integration tests

### Phase 5: Search & Security (Week 5)
- [ ] Search schema extension
- [ ] Security tests (webhook sigs, gitleaks, rate limits)

---

## 6. CI/CD Gates (Enforcement)

```yaml
# .github/workflows/ci.yml (expanded)
jobs:
  backend:
    # ... existing typecheck
  backend-tests:
    needs: [backend]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: backend/.nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
        working-directory: backend
      - run: pnpm test
        working-directory: backend
        env:
          DATABASE_URL: ${{ secrets.CI_DATABASE_URL }}  # Neon/test DB

  secrets-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: gitleaks/gitleaks-action@v2
```

### Branch Protection Rules (Required)
```yaml
# Required for master
- Require PR reviews (1)
- Require status checks: "Backend typecheck", "Backend unit tests", "Secrets scan", "Storefront typecheck and lint"
- Require branches up to date
- No force pushes
- No admin bypass
```

---

## 6. Local Dev Commands

```bash
# Unit tests only (fast, no DB)
cd backend && pnpm test

# Integration tests (needs local Postgres)
cd backend && pnpm test:integration

# All tests
pnpm test:all

# Watch mode
pnpm test:watch

# Coverage
pnpm test:coverage
```

---

## 7. Coverage Targets

| Layer | Target | Enforcement |
|-------|--------|-------------|
| Pure logic (`lib/`) | 100% | Enforced in CI |
| Subscribers | 90% | Enforced in CI |
| Payment providers | 85% | Enforced in CI |
| API routes | 80% | Advisory |
| Email templates | 100% snapshot | Advisory |
| Overall | 80% | CI gate |

---

## 8. Regression Test Registry

| Bug ID | Description | Test Location | Status |
|--------|-------------|---------------|--------|
| #1 | `setLineItemAdjustments` replaces entire set | `topup-math.test.ts` | ✅ |
| #2 | `nin` operator not in 2.19 | `exclusions/route.ts` | ✅ |
| #3 | `CAPTURED` vs `SUCCESSFUL` | `topup-math.test.ts` | ✅ |
| #4 | `CAPTURED` enum in Polar/Dodo | Provider services | ✅ |
| #5 | Polar prices snake_case → camelCase | `polar/service.ts` | ✅ |
| #6 | Dodo amount field verification | `dodo/service.ts` | ⚠️ Pending live key |
| #7 | `setLineItemAdjustments` replace-all | `topup-math.ts` | ✅ |
| #8 | `CAPTURED` vs `SUCCESSFUL` enum | `topup-math.test.ts` | ✅ |
| #9 | Dodo refund needs payment ID | `dodo/service.ts` | ✅ |
| #10 | Polar webhook `order.paid` → CAPTURED | `polar/service.ts` | ✅ |

---

## 9. Test Data Management

```typescript
// test-utils/factories.ts (to create)
export const createTestCart = async (overrides = {}) => { ... }
export const createTestOrder = async (overrides = {}) => { ... }
export const createTestPromotion = async (overrides = {}) => { ... }
export const createTestProduct = async (overrides = {}) => { ... }
export const createTestCustomer = async (overrides = {}) => { ... }
export const createTestGiftCard = async (overrides = {}) => { ... }
```

---

## 11. Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Backend Lead | | | |
| QA Lead | | | |
| Security Review | | | |

---

*Document control: Update on every PR that adds custom backend logic. Review quarterly.*