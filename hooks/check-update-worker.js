#!/usr/bin/env node
'use strict'

/**
 * Background worker for checking npm updates.
 * Invoked as a detached process by check-update.js.
 *
 * Expected environment variables:
 *   PULSIFY_CACHE_PATH  — path to write the update cache JSON
 *   PULSIFY_CACHE_DIR   — parent directory (created if missing)
 *   PULSIFY_INSTALLED   — currently installed version string
 */

const { execSync } = require('node:child_process')
const fs = require('node:fs')

const NPM_VIEW_TIMEOUT_MS = 10000

const cachePath = process.env.PULSIFY_CACHE_PATH
const cacheDir = process.env.PULSIFY_CACHE_DIR
const installed = process.env.PULSIFY_INSTALLED

if (!cachePath || !cacheDir || !installed) {
  process.exit(1)
}

try {
  const latest = execSync('npm view claude-code-pulsify version', {
    timeout: NPM_VIEW_TIMEOUT_MS,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim()
  fs.mkdirSync(cacheDir, { recursive: true })
  fs.writeFileSync(
    cachePath,
    JSON.stringify({
      installed,
      latest,
      updateAvailable: latest.localeCompare(installed, undefined, { numeric: true }) > 0,
      checkedAt: Date.now(),
    }),
  )
} catch {
  // Network error or npm not available — silently ignore
}
