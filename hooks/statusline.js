#!/usr/bin/env node
'use strict'

/**
 * Claude Code statusline hook.
 * Reads session JSON from stdin, outputs a formatted statusline,
 * and writes a bridge file for the context monitor.
 */

const fs = require('fs')
const path = require('path')

// ANSI helpers
const ESC = '\x1b['
const RESET = `${ESC}0m`
const BOLD = `${ESC}1m`
const DIM = `${ESC}2m`
const FG = (r, g, b) => `${ESC}38;2;${r};${g};${b}m`

// Colors
const GRAY = FG(100, 100, 100)
const WHITE = FG(200, 200, 200)
const GREEN = FG(80, 200, 80)
const YELLOW = FG(220, 200, 60)
const ORANGE = FG(230, 140, 40)
const RED = FG(220, 60, 60)
const CYAN = FG(80, 200, 220)

const SEPARATOR = `${GRAY}\u2502${RESET}`

// Autocompact kicks in around 16.5% remaining -- normalize so bar reflects usable context
const AUTOCOMPACT_BUFFER = 16.5

function normalizeUsage(remainingPct) {
  // remaining_percentage goes from 100 (empty) to 0 (full)
  // usable range is 100 down to ~16.5 (autocompact buffer)
  const usableRange = 100 - AUTOCOMPACT_BUFFER
  const usableRemaining = Math.max(0, remainingPct - AUTOCOMPACT_BUFFER)
  const usedPct = ((usableRange - usableRemaining) / usableRange) * 100
  return Math.min(100, Math.max(0, usedPct))
}

function getBarColor(usedPct) {
  if (usedPct < 50) return { fg: GREEN, label: GREEN }
  if (usedPct < 65) return { fg: YELLOW, label: YELLOW }
  if (usedPct < 80) return { fg: ORANGE, label: ORANGE }
  return { fg: RED, label: RED }
}

function buildProgressBar(usedPct, segments = 15) {
  const filled = Math.round((usedPct / 100) * segments)
  const empty = segments - filled
  const colors = getBarColor(usedPct)
  const emphasis = usedPct >= 80 ? BOLD : ''

  const filledBar = `${emphasis}${colors.fg}${'█'.repeat(filled)}${RESET}`
  const emptyBar = `${GRAY}${'░'.repeat(empty)}${RESET}`
  const pctLabel = `${colors.label}${BOLD}${Math.round(usedPct)}%${RESET}`

  return `${filledBar}${emptyBar} ${pctLabel}`
}

function getActiveTask(data) {
  const todos = data.todos || []
  const active = todos.find((t) => t.status === 'in_progress') || todos.find((t) => t.status === 'pending')
  if (!active) return null
  const label = active.content || active.description || ''
  return label.length > 40 ? label.slice(0, 37) + '...' : label
}

function getUpdateIndicator() {
  const configDir = process.env.CLAUDE_CONFIG_DIR || path.join(require('os').homedir(), '.claude')
  const cachePath = path.join(configDir, 'cache', 'claude-code-pulsify-update.json')
  try {
    const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'))
    if (cache.updateAvailable && cache.latest) {
      return ` ${CYAN}\u2191${cache.latest}${RESET}`
    }
  } catch {
    // No cache file or invalid — no indicator
  }
  return ''
}

function getGitBranch(cwd) {
  try {
    const head = fs.readFileSync(path.join(cwd, '.git', 'HEAD'), 'utf8').trim()
    const match = head.match(/^ref: refs\/heads\/(.+)$/)
    return match ? match[1] : null
  } catch {
    return null
  }
}

function writeBridgeFile(sessionId, metrics) {
  if (!sessionId) return
  const bridgePath = `/tmp/claude-ctx-${sessionId}.json`
  try {
    fs.writeFileSync(bridgePath, JSON.stringify({ ...metrics, timestamp: Date.now() }), 'utf8')
  } catch {
    // Silently ignore write errors
  }
}

async function main() {
  let input = ''
  for await (const chunk of process.stdin) {
    input += chunk
  }

  let data
  try {
    data = JSON.parse(input)
  } catch {
    process.stdout.write(`${DIM}statusline: no data${RESET}`)
    return
  }

  // Debug payload dump
  if (process.env.CLAUDE_PULSIFY_DEBUG) {
    try {
      fs.writeFileSync('/tmp/claude-pulsify-debug.json', JSON.stringify(data, null, 2), 'utf8')
    } catch {
      // Silently ignore write errors
    }
  }

  // Extract fields
  const model = data.model?.display_name || data.model?.name || 'unknown'
  const cwd = data.workspace?.current_dir || process.cwd()
  const dir = path.basename(cwd)
  const remainingPct = data.context_window?.remaining_percentage ?? 100
  const sessionId = data.session?.id || data.session_id || null

  // Normalize and build bar
  const usedPct = normalizeUsage(remainingPct)
  const bar = buildProgressBar(usedPct)

  // Git branch
  const branch = getGitBranch(cwd)
  const dirLabel = branch ? `${DIM}${dir} (${branch})${RESET}` : `${DIM}${dir}${RESET}`

  // Active task
  const task = getActiveTask(data)
  const taskSegment = task ? ` ${SEPARATOR} ${DIM}${task}${RESET}` : ''

  // Update indicator
  const updateIndicator = getUpdateIndicator()

  // Write bridge file for context-monitor
  writeBridgeFile(sessionId, {
    remaining_percentage: remainingPct,
    used_percentage: usedPct,
    session_id: sessionId,
    model,
  })

  // Output statusline
  const line = `${WHITE}${model}${RESET} ${SEPARATOR} ${dirLabel} ${SEPARATOR} ${bar}${taskSegment}${updateIndicator}`
  process.stdout.write(line)
}

main().catch(() => process.exit(0))
