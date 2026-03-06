#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')

const PACKAGE_VERSION = require('../package.json').version
const HOOKS_SOURCE = path.join(__dirname, '..', 'hooks')
const HOOK_FILES = ['statusline.js', 'context-monitor.js', 'check-update.js']

const configDir = process.env.CLAUDE_CONFIG_DIR || path.join(require('os').homedir(), '.claude')
const hooksTarget = path.join(configDir, 'hooks', 'claude-code-pulsify')
const settingsPath = path.join(configDir, 'settings.json')

// --- Helpers ---

function readJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    return {}
  }
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8')
}

function isOurEntry(entry) {
  const cmd = entry?.hooks?.[0]?.command || ''
  return cmd.includes('claude-code-pulsify')
}

function upsertHookArray(arr, newEntry) {
  const idx = arr.findIndex(isOurEntry)
  if (idx >= 0) {
    arr[idx] = newEntry
  } else {
    arr.push(newEntry)
  }
  return arr
}

function removeFromHookArray(arr) {
  return arr.filter((entry) => !isOurEntry(entry))
}

// --- Install ---

function install() {
  console.log(`\nInstalling claude-code-pulsify v${PACKAGE_VERSION}...\n`)

  // 1. Copy hooks
  fs.mkdirSync(hooksTarget, { recursive: true })
  for (const file of HOOK_FILES) {
    const src = path.join(HOOKS_SOURCE, file)
    const dst = path.join(hooksTarget, file)
    fs.copyFileSync(src, dst)
    console.log(`  Copied ${file}`)
  }

  // 2. Write VERSION
  fs.writeFileSync(path.join(hooksTarget, 'VERSION'), PACKAGE_VERSION, 'utf8')
  console.log(`  Wrote VERSION (${PACKAGE_VERSION})`)

  // 3. Patch settings.json
  const settings = readJSON(settingsPath)

  // statusLine
  settings.statusLine = {
    type: 'command',
    command: `node ${path.join(hooksTarget, 'statusline.js')}`,
  }

  // hooks
  if (!settings.hooks) settings.hooks = {}

  // PostToolUse — context-monitor
  if (!settings.hooks.PostToolUse) settings.hooks.PostToolUse = []
  upsertHookArray(settings.hooks.PostToolUse, {
    hooks: [
      {
        type: 'command',
        command: `node ${path.join(hooksTarget, 'context-monitor.js')}`,
      },
    ],
  })

  // SessionStart — check-update
  if (!settings.hooks.SessionStart) settings.hooks.SessionStart = []
  upsertHookArray(settings.hooks.SessionStart, {
    hooks: [
      {
        type: 'command',
        command: `node ${path.join(hooksTarget, 'check-update.js')}`,
      },
    ],
  })

  writeJSON(settingsPath, settings)
  console.log(`  Patched settings.json`)

  console.log(`\nDone! Restart Claude Code to activate the statusline.\n`)
}

// --- Uninstall ---

function uninstall() {
  console.log(`\nUninstalling claude-code-pulsify...\n`)

  // 1. Remove hooks directory
  if (fs.existsSync(hooksTarget)) {
    fs.rmSync(hooksTarget, { recursive: true })
    console.log(`  Removed ${hooksTarget}`)
  }

  // 2. Clean settings.json
  if (fs.existsSync(settingsPath)) {
    const settings = readJSON(settingsPath)

    // Remove statusLine if it's ours
    if (settings.statusLine?.command?.includes('claude-code-pulsify')) {
      delete settings.statusLine
      console.log(`  Removed statusLine config`)
    }

    // Remove hook entries
    if (settings.hooks) {
      for (const event of ['PostToolUse', 'SessionStart']) {
        if (Array.isArray(settings.hooks[event])) {
          settings.hooks[event] = removeFromHookArray(settings.hooks[event])
          if (settings.hooks[event].length === 0) {
            delete settings.hooks[event]
          }
        }
      }
      if (Object.keys(settings.hooks).length === 0) {
        delete settings.hooks
      }
      console.log(`  Cleaned hook entries`)
    }

    writeJSON(settingsPath, settings)
  }

  // 3. Remove cache file
  const cachePath = path.join(configDir, 'cache', 'claude-code-pulsify-update.json')
  try {
    fs.unlinkSync(cachePath)
  } catch {
    // Doesn't exist — fine
  }

  console.log(`\nDone! claude-code-pulsify has been removed.\n`)
}

// --- Main ---

const args = process.argv.slice(2)

if (args.includes('--version')) {
  console.log(PACKAGE_VERSION)
} else if (args.includes('--uninstall')) {
  uninstall()
} else {
  install()
}
