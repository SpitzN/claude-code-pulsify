#!/usr/bin/env node
'use strict'

/**
 * Claude Code PostToolUse hook -- context monitor.
 * Reads the bridge file written by statusline.js and injects
 * warnings when context is running low.
 */

const fs = require('node:fs')
const path = require('node:path')

// Thresholds on "used percentage" (normalized, 0-100)
const WARNING_THRESHOLD = 65 // remaining ~35% usable
const CRITICAL_THRESHOLD = 75 // remaining ~25% usable

// Debounce: minimum tool calls between repeated warnings at the same severity
const DEBOUNCE_COUNT = 5

// Bridge data older than this is considered stale and ignored
const BRIDGE_STALE_MS = 60_000

function sanitizeId(id) {
  return id.replace(/[^a-zA-Z0-9_-]/g, '')
}

// State file to track debounce across invocations
function getStateFile(sessionId) {
  return `/tmp/claude-ctx-monitor-state-${sanitizeId(sessionId)}.json`
}

function readState(sessionId) {
  try {
    return JSON.parse(fs.readFileSync(getStateFile(sessionId), 'utf8'))
  } catch {
    return { lastSeverity: null, callsSinceWarning: 0 }
  }
}

function writeState(sessionId, state) {
  try {
    fs.writeFileSync(getStateFile(sessionId), JSON.stringify(state), 'utf8')
  } catch {
    // Silently ignore
  }
}

async function main() {
  let input = ''
  for await (const chunk of process.stdin) {
    input += chunk
  }

  let hookData
  try {
    hookData = JSON.parse(input)
  } catch {
    return
  }

  const sessionId = hookData.session?.id || hookData.session_id || null
  if (!sessionId) return

  // Read bridge file from statusline
  const bridgePath = `/tmp/claude-ctx-${sanitizeId(sessionId)}.json`
  let metrics
  try {
    metrics = JSON.parse(fs.readFileSync(bridgePath, 'utf8'))
  } catch {
    return // No bridge file yet -- statusline hasn't run
  }

  // Check staleness
  if (Date.now() - (metrics.timestamp || 0) > BRIDGE_STALE_MS) return

  const usedPct = metrics.used_percentage
  if (usedPct == null) return

  // Determine severity
  let severity = null
  if (usedPct >= CRITICAL_THRESHOLD) severity = 'CRITICAL'
  else if (usedPct >= WARNING_THRESHOLD) severity = 'WARNING'

  if (!severity) return // Context is fine

  // Debounce logic
  const state = readState(sessionId)
  state.callsSinceWarning = (state.callsSinceWarning || 0) + 1

  const isEscalation = severity === 'CRITICAL' && state.lastSeverity === 'WARNING'
  const shouldWarn = isEscalation || state.callsSinceWarning >= DEBOUNCE_COUNT

  if (!shouldWarn) {
    writeState(sessionId, state)
    return
  }

  // Reset debounce counter
  state.callsSinceWarning = 0
  state.lastSeverity = severity
  writeState(sessionId, state)

  // Emit warning
  const pct = Math.round(usedPct)
  const remaining = 100 - pct

  if (severity === 'CRITICAL') {
    process.stderr.write(
      `\n⚠️  CONTEXT CRITICAL (${pct}% used, ~${remaining}% remaining)\n` +
        `Context window is nearly exhausted. Inform the user and ask how to proceed.\n` +
        `Consider: summarize progress, commit work, or start a new session.\n`,
    )
  } else {
    process.stderr.write(
      `\n⚡ CONTEXT WARNING (${pct}% used, ~${remaining}% remaining)\n` +
        `Context is getting limited. Avoid starting new complex work.\n` +
        `Focus on completing current tasks and wrapping up.\n`,
    )
  }
}

main().catch((err) => {
  if (process.env.CLAUDE_PULSIFY_DEBUG) {
    process.stderr.write(`[pulsify:context-monitor] ${err.message}\n`)
  }
  process.exit(0)
})
