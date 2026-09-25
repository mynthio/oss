import type { ByokProvider } from "@tanstack/ai/byok";
import { defineByokProvider } from "@tanstack/ai/byok";

/**
 * BYOK descriptor for Mynth. Safe to import in the browser: it holds the
 * provider id and the env var name, never a key.
 *
 * On the relay, read the user's key with
 * `getByokKey(request, mynthByok)` from `@tanstack/ai/byok/server` and pass it
 * to `mynthImage(model, { apiKey })`.
 */
export const mynthByok: ByokProvider<"mynth"> = defineByokProvider({
  id: "mynth",
  label: "Mynth",
  env: "MYNTH_API_KEY",
});
