/**
 * Attention hub — heartbeat writer. Jobs call this at the end of a pass
 * (ok) and from their catch block (error). Upsert by name, never throws:
 * monitoring must not break the thing it monitors. Pure MedusaService
 * calls, so it is unit-testable with a stub.
 */
export async function heartbeat(
  container: { resolve: (key: string) => any },
  name: string,
  ok: boolean,
  error?: unknown
): Promise<void> {
  try {
    const ops = container.resolve("ops") as any;
    const patch =
      ok
        ? { last_ok_at: new Date(), last_error: null }
        : {
            last_error: String(
              (error as Error)?.message ?? error ?? "unknown error"
            ).slice(0, 280),
          };
    const existing = await ops.listOpsHeartbeats({ name });
    if (existing?.length) {
      await ops.updateOpsHeartbeats({ id: existing[0].id, ...patch });
    } else {
      await ops.createOpsHeartbeats({ name, ...patch });
    }
  } catch {
    // Monitoring is best-effort by design.
  }
}
