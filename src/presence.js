// Turns a last_seen timestamp into a soft, ambient presence label —
// deliberately vaguer than "online" / "last seen at 10:42am".
export function presenceLabel(lastSeenIso) {
  if (!lastSeenIso) return null
  const diffMs = Date.now() - new Date(lastSeenIso).getTime()
  const minutes = diffMs / 60000
  if (minutes < 3) return { label: 'here', glow: 1 }
  if (minutes < 30) return { label: 'recently', glow: 0.6 }
  if (minutes < 60 * 24) return { label: 'today', glow: 0.3 }
  return { label: 'adrift', glow: 0.1 }
}

// Light-touch nudge based on how long since you last messaged this person —
// not a strict day-streak counter, just a gentle signal.
export function conversationNudge(lastMessageAtIso) {
  if (!lastMessageAtIso) return null
  const diffMs = Date.now() - new Date(lastMessageAtIso).getTime()
  const hours = diffMs / 3600000
  const days = hours / 24
  if (hours < 24) return { text: 'talked today', tone: 'warm' }
  if (days < 14) return null
  if (days < 30) return { text: `haven't talked in ${Math.floor(days)}d`, tone: 'nudge' }
  return { text: 'drifted apart', tone: 'nudge' }
}