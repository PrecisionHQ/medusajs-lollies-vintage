"use client";

import { useEffect, useState } from "react";
import { retrieveCart } from "@lib/data/cart";
import { onCartUpdated } from "@lib/util/cart-events";

/**
 * Live cart badge: total item quantity from the real Medusa cart.
 * Refreshes on mount and on every cart mutation event.
 */
export default function CartLength() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const cart = await retrieveCart();
        if (!cancelled) {
          setCount(
            (cart?.items || []).reduce((sum, i) => sum + (i.quantity || 0), 0)
          );
        }
      } catch {
        if (!cancelled) setCount(0);
      }
    };
    load();
    return onCartUpdated(load);
  }, []);

  return <>{count}</>;
}
