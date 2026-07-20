// Simple binary presence: "online" if active in the last 2 minutes, else "offline".
export function isOnline(lastSeenIso) {
  if (!lastSeenIso) return false
  const diffMs = Date.now() - new Date(lastSeenIso).getTime()
  return diffMs < 2 * 60 * 1000
}