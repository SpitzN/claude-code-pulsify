'use strict'

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
}

function removeFromHookArray(arr) {
  return arr.filter((entry) => !isOurEntry(entry))
}

module.exports = { isOurEntry, upsertHookArray, removeFromHookArray }
