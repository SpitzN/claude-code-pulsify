'use strict'

// Thresholds on "used percentage" (normalized, 0-100)
const WARNING_THRESHOLD = 65 // remaining ~35% usable
const CRITICAL_THRESHOLD = 75 // remaining ~25% usable

// Debounce: minimum tool calls between repeated warnings at the same severity
const DEBOUNCE_COUNT = 5

// Bridge data older than this is considered stale and ignored
const BRIDGE_STALE_MS = 60_000

function getSeverity(usedPct) {
  if (usedPct >= CRITICAL_THRESHOLD) return 'CRITICAL'
  if (usedPct >= WARNING_THRESHOLD) return 'WARNING'
  return null
}

function shouldFireWarning(callsSinceWarning, severity, lastSeverity) {
  const isEscalation = severity === 'CRITICAL' && lastSeverity === 'WARNING'
  return isEscalation || callsSinceWarning >= DEBOUNCE_COUNT
}

module.exports = {
  WARNING_THRESHOLD,
  CRITICAL_THRESHOLD,
  DEBOUNCE_COUNT,
  BRIDGE_STALE_MS,
  getSeverity,
  shouldFireWarning,
}
