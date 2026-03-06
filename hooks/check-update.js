#!/usr/bin/env node
'use strict'

/**
 * SessionStart hook -- background version check for claude-code-pulsify.
 * Spawns a detached worker process to compare installed version vs npm latest,
 * writes result to a cache file that statusline.js reads.
 */

const { spawn } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const configDir = process.env.CLAUDE_CONFIG_DIR || path.join(require('node:os').homedir(), '.claude')
const hooksDir = path.join(configDir, 'hooks', 'claude-code-pulsify')
const cacheDir = path.join(configDir, 'cache')
const cachePath = path.join(cacheDir, 'claude-code-pulsify-update.json')

async function main() {
  // Consume stdin (required by hook protocol)
  let input = ''
  for await (const chunk of process.stdin) {
    input += chunk
  }

  // Read installed version
  const versionFile = path.join(hooksDir, 'VERSION')
  let installed
  try {
    installed = fs.readFileSync(versionFile, 'utf8').trim()
  } catch {
    return // No VERSION file — not installed properly
  }

  // Spawn detached background worker so we don't block session startup
  const workerPath = path.join(__dirname, 'check-update-worker.js')
  const child = spawn(process.execPath, [workerPath], {
    detached: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      PULSIFY_CACHE_PATH: cachePath,
      PULSIFY_CACHE_DIR: cacheDir,
      PULSIFY_INSTALLED: installed,
    },
  })
  child.unref()
}

main().catch((err) => {
  if (process.env.CLAUDE_PULSIFY_DEBUG) {
    process.stderr.write(`[pulsify:check-update] ${err.message}\n`)
  }
  process.exit(0)
})
