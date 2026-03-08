'use strict'

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

function formatCost(costUsd) {
  if (!costUsd) return ''
  if (costUsd < 1) return `${WHITE}$${costUsd.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}${RESET}`
  const str = costUsd.toFixed(1).replace(/\.0$/, '')
  return `${WHITE}$${str}${RESET}`
}

module.exports = {
  // ANSI helpers
  RESET, DIM, WHITE, CYAN,
  SEPARATOR,
  // Functions
  sanitizeId, normalizeUsage, getBarColor, buildProgressBar, getActiveTask, formatCost,
}
