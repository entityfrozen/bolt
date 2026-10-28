// Read-only flag written by the game's self-hosted HTML entrypoint.
// Never let an ordinary OpenFront deployment silently change its auth policy.
export function isWorldPvPStandalone(): boolean {
  return (
    typeof window !== "undefined" &&
    (window as Window & { WORLDPVP_STANDALONE?: boolean }).WORLDPVP_STANDALONE === true
  );
}
