export function isPaidByGiftCard(cart?: {
  total?: number | null
  credit_lines?: { reference?: string | null }[] | null
} | null): boolean {
  return (
    !!cart &&
    (cart.credit_lines ?? []).some(
      (line) => line.reference === "gift-card"
    ) &&
    (cart.total ?? -1) === 0
  )
}
