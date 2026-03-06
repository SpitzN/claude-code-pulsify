#!/usr/bin/env node
'use strict'

/**
 * Claude Code statusline hook.
 * Reads session JSON from stdin, outputs a formatted statusline,
 * and writes a bridge file for the context monitor.
 */

const fs = require('node:fs')
const path = require('node:path')

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

const PROGRESS_BAR_SEGMENTS = 15
const MAX_TASK_LABEL_LENGTH = 40

// Claude's autocompact kicks in around 16.5% remaining context.
// We normalize the bar so 0% = empty, 100% = autocompact threshold,
// giving users a view of their *usable* context rather than total.
const AUTOCOMPACT_BUFFER = 16.5

function sanitizeId(id) {
  return id.replace(/[^a-zA-Z0-9_-]/g, '')
}

function normalizeUsage(remainingPct) {
  // remaining_percentage goes from 100 (empty) to 0 (full)
  // usable range is 100 down to ~16.5 (autocompact buffer)
  const usableRange = 100 - AUTOCOMPACT_BUFFER
  const usableRemaining = Math.max(0, remainingPct - AUTOCOMPACT_BUFFER)
  const usedPct = ((usableRange - usableRemaining) / usableRange) * 100
  return Math.min(100, Math.max(0, usedPct))
}

function getBarColor(usedPct) {
  if (usedPct < 50) return GREEN
  if (usedPct < 65) return YELLOW
  if (usedPct < 80) return ORANGE
  return RED
}

function buildProgressBar(usedPct) {
  const filled = Math.round((usedPct / 100) * PROGRESS_BAR_SEGMENTS)
  const empty = PROGRESS_BAR_SEGMENTS - filled
  const color = getBarColor(usedPct)
  const emphasis = usedPct >= 80 ? BOLD : ''

  const filledBar = `${emphasis}${color}${'█'.repeat(filled)}${RESET}`
  const emptyBar = `${GRAY}${'░'.repeat(empty)}${RESET}`
  const pctLabel = `${color}${BOLD}${Math.round(usedPct)}%${RESET}`

  return `${filledBar}${emptyBar} ${pctLabel}`
}

function getActiveTask(data) {
  const todos = data.todos || []
  const active = todos.find((t) => t.status === 'in_progress') || todos.find((t) => t.status === 'pending')
  if (!active) return null
  const label = active.content || active.description || ''
  return label.length > MAX_TASK_LABEL_LENGTH ? label.slice(0, MAX_TASK_LABEL_LENGTH - 3) + '...' : label
}

function getUpdateIndicator() {
  const configDir = process.env.CLAUDE_CONFIG_DIR || path.join(require('node:os').homedir(), '.claude')
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
  const safeId = sanitizeId(sessionId)
  const bridgePath = `/tmp/claude-ctx-${safeId}.json`
  const tmpPath = `${bridgePath}.tmp`
  try {
    fs.writeFileSync(tmpPath, JSON.stringify({ ...metrics, timestamp: Date.now() }), 'utf8')
    fs.renameSync(tmpPath, bridgePath)
  } catch {
    // Silently ignore write errors
  }
}

function formatCost(costUsd) {
  if (!costUsd) return ''
  if (costUsd < 1) return `${WHITE}$${costUsd.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}${RESET}`
  const str = costUsd.toFixed(1).replace(/\.0$/, '')
  return `${WHITE}$${str}${RESET}`
}

function formatLinesChanged(added, removed) {
  const parts = []
  if (added) parts.push(`${GREEN}+${added}${RESET}`)
  if (removed) parts.push(`${RED}-${removed}${RESET}`)
  return parts.join(' ')
}

function formatTokenCount(input, output) {
  const total = (input || 0) + (output || 0)
  if (!total) return ''
  let compact
  if (total >= 1e6) compact = `${(total / 1e6).toFixed(1)}M`
  else if (total >= 1e3) compact = `${(total / 1e3).toFixed(1)}k`
  else compact = `${total}`
  return `${DIM}${compact} tok${RESET}`
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
      const debugData = {
        ...data,
        _debug: {
          process_cwd: process.cwd(),
          env_PWD: process.env.PWD || null,
          env_HOME: process.env.HOME || null,
          argv: process.argv,
          timestamp: new Date().toISOString(),
        },
      }
      fs.writeFileSync('/tmp/claude-pulsify-debug.json', JSON.stringify(debugData, null, 2), 'utf8')
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
  const costUsd = data.cost?.total_cost_usd ?? 0
  const linesAdded = data.cost?.total_lines_added ?? 0
  const linesRemoved = data.cost?.total_lines_removed ?? 0
  const totalInputTokens = data.context_window?.total_input_tokens ?? 0
  const totalOutputTokens = data.context_window?.total_output_tokens ?? 0

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

  // Format new segments
  const cost = formatCost(costUsd)
  const lines = formatLinesChanged(linesAdded, linesRemoved)
  const tokenCount = formatTokenCount(totalInputTokens, totalOutputTokens)

  // Build segments array (only include non-empty optional segments)
  const segments = [
    `${WHITE}${model}${RESET}`,
    dirLabel,
  ]
  if (cost) segments.push(cost)
  if (lines) segments.push(lines)
  const barWithTokens = tokenCount ? `${bar} ${tokenCount}` : bar
  segments.push(barWithTokens)

  // Output statusline
  const line = segments.join(` ${SEPARATOR} `) + taskSegment + updateIndicator
  process.stdout.write(line)
}

main().catch((err) => {
  if (process.env.CLAUDE_PULSIFY_DEBUG) {
    process.stderr.write(`[pulsify:statusline] ${err.message}\n`)
  }
  process.exit(0)
})
