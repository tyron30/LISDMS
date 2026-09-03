import { isSupabaseConfigured, getSupabaseClient } from "./supabase";

// Fire-and-forget audit log write. Failures are swallowed (logging should
// never block or break the action it's describing) but surfaced to the
// console for debugging.
export async function logAction(action: string, target?: string) {
  if (!isSupabaseConfigured) return;
  try {
    const supabase = getSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase.from("audit_logs").insert({
      actor: user?.email ?? "Unknown",
      action,
      target: target ?? null,
    });
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}
