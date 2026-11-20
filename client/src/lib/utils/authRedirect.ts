/** Accept only an internal router Location, never an external redirect URL. */
export function authReturnTo(state: unknown, fallback = "/dashboard"): string {
  if (!state || typeof state !== "object" || !("from" in state))
    return fallback;
  const from = state.from;
  if (!from || typeof from !== "object" || !("pathname" in from))
    return fallback;
  const path = from.pathname;
  if (
    typeof path !== "string" ||
    !path.startsWith("/") ||
    path.startsWith("//") ||
    /[\\\s]/.test(path)
  )
    return fallback;
  if (/^\/(login|register|forgot-password|reset-password)(?:\/|$)/.test(path))
    return fallback;
  const search =
    "search" in from &&
    typeof from.search === "string" &&
    from.search.startsWith("?")
      ? from.search
      : "";
  const hash =
    "hash" in from && typeof from.hash === "string" && from.hash.startsWith("#")
      ? from.hash
      : "";
  return path + search + hash;
}
