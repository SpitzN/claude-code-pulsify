#!/usr/bin/env node
'use strict'

/**
 * SessionStart hook -- background version check for claude-code-pulsify.
 * Spawns a detached process to compare installed version vs npm latest,
 * writes result to a cache file that statusline.js reads.
 */

const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

const configDir = process.env.CLAUDE_CONFIG_DIR || path.join(require('os').homedir(), '.claude')
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

  // Spawn detached background check so we don't block session startup
  const script = `
    const { execSync } = require('child_process');
    const fs = require('fs');
    const cachePath = ${JSON.stringify(cachePath)};
    const cacheDir = ${JSON.stringify(cacheDir)};
    const installed = ${JSON.stringify(installed)};
    try {
      const latest = execSync('npm view claude-code-pulsify version', {
        timeout: 10000,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      }).trim();
      fs.mkdirSync(cacheDir, { recursive: true });
      fs.writeFileSync(cachePath, JSON.stringify({
        installed,
        latest,
        updateAvailable: latest !== installed,
        checkedAt: Date.now()
      }));
    } catch {
      // Network error or npm not available — silently ignore
    }
  `

  const child = spawn(process.execPath, ['-e', script], {
    detached: true,
    stdio: 'ignore',
  })
  child.unref()
}

main().catch(() => process.exit(0))
