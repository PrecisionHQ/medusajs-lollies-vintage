import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { VAPID_PUBLIC_KEY } from "../../../../lib/constants";

/**
 * PWA phone app — public VAPID key for pushManager.subscribe().
 * Public by design; 404s (not 500s) when the backend has no push keys yet.
 */
export const GET = async (_req: MedusaRequest, res: MedusaResponse) => {
  if (!VAPID_PUBLIC_KEY) {
    res.status(404).json({ message: "Push is not configured." });
    return;
  }
  res.json({ publicKey: VAPID_PUBLIC_KEY });
};
