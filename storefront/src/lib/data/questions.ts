"use server"

import { sdk } from "@lib/config"
import { cache } from "react"
import { getCacheDirectives, revalidateCacheTag } from "./cookies"

export type StoreQuestion = {
  id: string
  name: string
  question: string
  answer: string | null
  created_at: string
}

/**
 * Q&A reads and writes (#11). Reads are cached + tagged; the ask form is a
 * server action so guests never need an account. Validation mirrors the
 * backend messages so the modal can show them inline.
 */
export const getProductQuestions = cache(async function (productId: string) {
  return sdk.client
    .fetch<{ questions: StoreQuestion[]; count: number }>(
      `/store/products/${productId}/questions`,
      {
        method: "GET",
        ...(await getCacheDirectives("questions")),
      }
    )
    .catch(() => ({ questions: [], count: 0 }))
})

export async function askQuestion(
  productId: string,
  input: { name: string; email: string; question: string; locale?: string }
): Promise<{ ok: boolean; error?: string }> {
  try {
    await sdk.client.fetch(`/store/products/${productId}/questions`, {
      method: "POST",
      body: input,
    })
    await revalidateCacheTag("questions")
    return { ok: true }
  } catch (e: any) {
    const message: string | undefined =
      e?.response?.data?.message ?? e?.message
    if (e?.status === 429 || e?.response?.status === 429) {
      return { ok: false, error: "ratelimited" }
    }
    return { ok: false, error: message ?? "failed" }
  }
}
