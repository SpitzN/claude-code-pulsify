'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

const { isOurEntry, upsertHookArray, removeFromHookArray } = require('../lib/install')

describe('isOurEntry', () => {
  it('matching entry → true', () => {
    const entry = { hooks: [{ command: 'node /path/to/claude-code-pulsify/hooks/statusline.js' }] }
    assert.equal(isOurEntry(entry), true)
  })

  it('non-matching entry → false', () => {
    const entry = { hooks: [{ command: 'node /path/to/other-tool/hook.js' }] }
    assert.equal(isOurEntry(entry), false)
  })

  it('missing hooks → false', () => {
    assert.equal(isOurEntry({}), false)
    assert.equal(isOurEntry({ hooks: [] }), false)
  })

  it('null/undefined entry → false', () => {
    assert.equal(isOurEntry(null), false)
    assert.equal(isOurEntry(undefined), false)
  })
})

describe('upsertHookArray', () => {
  it('inserts when not present', () => {
    const arr = [{ hooks: [{ command: 'other-tool' }] }]
    const newEntry = { hooks: [{ command: 'node /path/to/claude-code-pulsify/hooks/test.js' }] }
    upsertHookArray(arr, newEntry)
    assert.equal(arr.length, 2)
    assert.equal(arr[1], newEntry)
  })

  it('updates existing entry in-place', () => {
    const arr = [
      { hooks: [{ command: 'other-tool' }] },
      { hooks: [{ command: 'node /old/claude-code-pulsify/hooks/old.js' }] },
    ]
    const newEntry = { hooks: [{ command: 'node /new/claude-code-pulsify/hooks/new.js' }] }
    upsertHookArray(arr, newEntry)
    assert.equal(arr.length, 2)
    assert.equal(arr[1], newEntry)
  })

  it('works with empty array', () => {
    const arr = []
    const newEntry = { hooks: [{ command: 'node /path/to/claude-code-pulsify/hooks/test.js' }] }
    upsertHookArray(arr, newEntry)
    assert.equal(arr.length, 1)
    assert.equal(arr[0], newEntry)
  })
})

describe('removeFromHookArray', () => {
  it('filters out pulsify entries', () => {
    const arr = [
      { hooks: [{ command: 'other-tool' }] },
      { hooks: [{ command: 'node /path/to/claude-code-pulsify/hooks/test.js' }] },
    ]
    const result = removeFromHookArray(arr)
    assert.equal(result.length, 1)
    assert.ok(result[0].hooks[0].command.includes('other-tool'))
  })

  it('keeps other entries', () => {
    const arr = [
      { hooks: [{ command: 'tool-a' }] },
      { hooks: [{ command: 'tool-b' }] },
    ]
    const result = removeFromHookArray(arr)
    assert.equal(result.length, 2)
  })

  it('returns empty array when all removed', () => {
    const arr = [
      { hooks: [{ command: 'node /a/claude-code-pulsify/hooks/a.js' }] },
      { hooks: [{ command: 'node /b/claude-code-pulsify/hooks/b.js' }] },
    ]
    const result = removeFromHookArray(arr)
    assert.equal(result.length, 0)
  })
})
