import "server-only"
import { revalidateTag } from "next/cache"
import { cookies } from "next/headers"

/**
 * Cache tags, two tiers.
 *
 * GLOBAL (default): data identical for every visitor — products,
 * collections, categories, regions, reviews, shipping methods list,
 * payment providers. The tag is shared, needs no request scope (so
 * build-time reads in generateStaticParams stay tagged), and one purge
 * refreshes everyone.
 *
 * VISITOR (`{ visitor: true }`): data that varies per shopper — carts,
 * customers, orders, auth, per-cart shipping. The tag is suffixed with
 * the middleware-issued `_medusa_cache_id`, so one shopper's
 * revalidateTag can never purge another shopper's entries. Next keys its
 * data cache by URL plus request options, so cached entries never
 * collide between visitors even on authenticated calls — tags are the
 * only shared axis, hence the suffix.
 *
 * The try/catch is load-bearing, not defensive padding. `cookies()` throws
 * when there is no request scope, which is the case inside
 * generateStaticParams: both the product and category routes call into
 * this data layer at build time. Swallowing it there degrades a visitor
 * read to untagged/uncached, which is correct for a build (global reads
 * never touch cookies at all).
 */
export const getCacheTag = async (
  tag: string,
  opts?: { visitor?: boolean }
): Promise<string> => {
  if (!opts?.visitor) {
    return tag
  }
  try {
    const cookiesStore = await cookies()
    const cacheId = cookiesStore.get("_medusa_cache_id")?.value

    if (!cacheId) {
      return ""
    }

    return `${tag}-${cacheId}`
  } catch (error) {
    return ""
  }
}

/**
 * Fetch directives for a cacheable read.
 *
 * Deliberately never force-cache without a tag. An untagged force-cache entry
 * is one revalidateTag can never reach, so a cart or a customer profile would
 * stay pinned to its first value for the life of the deployment.
 *
 * With no tag it returns nothing at all and lets Next decide. An earlier
 * version returned `cache: "no-store"` here, on the reasoning that giving up
 * the cache is safer than an unpurgeable entry. That was right about the
 * intent and wrong in practice: an explicit no-store is a dynamic API, so
 * every route that reads data through this at build time was kicked out of
 * static rendering with DYNAMIC_SERVER_USAGE. Saying nothing gets the same
 * safety without opting the whole storefront out of prerendering.
 */
export const getCacheDirectives = async (
  tag: string,
  opts?: { visitor?: boolean }
): Promise<{} | { cache: "force-cache"; next: { tags: string[] } }> => {
  const cacheTag = await getCacheTag(tag, opts)

  if (!cacheTag) {
    return {}
  }

  return { cache: "force-cache", next: { tags: [cacheTag] } }
}

/**
 * Invalidates entries for a tag — global, or one visitor's when
 * `{ visitor: true }` matches how the read was cached.
 *
 * Visitor purges no-op without a cache id, which is exactly the case
 * where getCacheDirectives left the read uncached, so there is nothing
 * to purge.
 */
export const revalidateCacheTag = async (
  tag: string,
  opts?: { visitor?: boolean }
): Promise<void> => {
  const cacheTag = await getCacheTag(tag, opts)

  if (cacheTag) {
    revalidateTag(cacheTag)
  }
}

export const getAuthHeaders = async (): Promise<{ authorization: string } | {}> => {
  const cookiesStore = await cookies()
  const token = cookiesStore.get("_medusa_jwt")?.value

  if (token) {
    return { authorization: `Bearer ${token}` }
  }

  return {}
}

export const setAuthToken = async (token: string) => {
  const cookiesStore = await cookies()
  cookiesStore.set("_medusa_jwt", token, {
    maxAge: 60 * 60 * 24 * 7,
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  })
}

export const removeAuthToken = async () => {
  const cookiesStore = await cookies()
  cookiesStore.set("_medusa_jwt", "", {
    maxAge: -1,
  })
}

export const getCartId = async () => {
  const cookiesStore = await cookies()
  return cookiesStore.get("_medusa_cart_id")?.value
}

export const setCartId = async (cartId: string) => {
  const cookiesStore = await cookies()
  cookiesStore.set("_medusa_cart_id", cartId, {
    maxAge: 60 * 60 * 24 * 7,
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  })
}

export const removeCartId = async () => {
  const cookiesStore = await cookies()
  cookiesStore.set("_medusa_cart_id", "", { maxAge: -1 })
}
