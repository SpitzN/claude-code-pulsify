#!/usr/bin/env node
'use strict'

/**
 * Claude Code statusline hook.
 * Reads session JSON from stdin, outputs a formatted statusline,
 * and writes a bridge file for the context monitor.
 */

const fs = require('node:fs')
const path = require('node:path')

const {
  RESET, DIM, WHITE, CYAN, SEPARATOR,
  sanitizeId, normalizeUsage, buildProgressBar, getActiveTask, formatCost,
} = require('../lib/statusline')

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

async function main() {
  let input = ''
  await Promise.race([
    (async () => { for await (const chunk of process.stdin) input += chunk })(),
    new Promise((resolve) => setTimeout(resolve, 5000)),
  ])

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

  // Format cost
  const cost = formatCost(costUsd)

  // Build segments array (only include non-empty optional segments)
  const segments = [
    `${WHITE}${model}${RESET}`,
    dirLabel,
  ]
  if (cost) segments.push(cost)
  segments.push(bar)

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
