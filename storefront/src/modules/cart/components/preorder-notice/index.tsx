import { getPreorderFlags } from "@lib/data/preorders"

/**
 * PR-09 — Cart/checkout disclosure. Server-rendered from the cart's variant
 * ids: when any line is a preorder, the shopper is told before paying that
 * capture happens on shipment, not today.
 */
export default async function PreorderNotice({
  variantIds,
}: {
  variantIds: string[]
}) {
  if (!variantIds.length) {
    return null
  }
  const flags = await getPreorderFlags({ variantIds })
  const entries = Object.entries(flags)
  if (!entries.length) {
    return null
  }

  return (
    <div className="border border-ui-border-strong rounded p-3 text-small-regular">
      <p className="font-semibold">This order contains preorder items</p>
      <ul className="text-ui-fg-subtle">
        {entries.map(([_, flag]) => (
          <li key={flag.eta_text}>
            Ships: {flag.eta_text}
          </li>
        ))}
      </ul>
      <p className="text-ui-fg-subtle">
        Payment is authorized now and captured when your order ships.
      </p>
    </div>
  )
}
