'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

const { sanitizeId } = require('../lib/statusline')
const { WARNING_THRESHOLD, CRITICAL_THRESHOLD, DEBOUNCE_COUNT, BRIDGE_STALE_MS, getSeverity, shouldFireWarning } = require('../lib/context')

describe('sanitizeId', () => {
  it('passes through normal id', () => {
    assert.equal(sanitizeId('session-abc_123'), 'session-abc_123')
  })

  it('strips special characters', () => {
    assert.equal(sanitizeId('test/id@special!'), 'testidspecial')
  })

  it('handles empty string', () => {
    assert.equal(sanitizeId(''), '')
  })
})

describe('threshold constants', () => {
  it('WARNING_THRESHOLD is 65', () => {
    assert.equal(WARNING_THRESHOLD, 65)
  })

  it('CRITICAL_THRESHOLD is 75', () => {
    assert.equal(CRITICAL_THRESHOLD, 75)
  })

  it('CRITICAL > WARNING', () => {
    assert.ok(CRITICAL_THRESHOLD > WARNING_THRESHOLD)
  })
})

describe('getSeverity', () => {
  it('<65 → null (no warning)', () => {
    assert.equal(getSeverity(0), null)
    assert.equal(getSeverity(50), null)
    assert.equal(getSeverity(64), null)
  })

  it('65 → WARNING (boundary)', () => {
    assert.equal(getSeverity(65), 'WARNING')
  })

  it('65-74 → WARNING', () => {
    assert.equal(getSeverity(70), 'WARNING')
    assert.equal(getSeverity(74), 'WARNING')
  })

  it('75 → CRITICAL (boundary)', () => {
    assert.equal(getSeverity(75), 'CRITICAL')
  })

  it('≥75 → CRITICAL', () => {
    assert.equal(getSeverity(80), 'CRITICAL')
    assert.equal(getSeverity(100), 'CRITICAL')
  })
})

describe('shouldFireWarning', () => {
  it('callsSinceWarning < DEBOUNCE_COUNT → suppress', () => {
    assert.equal(shouldFireWarning(0, 'WARNING', null), false)
    assert.equal(shouldFireWarning(4, 'WARNING', null), false)
  })

  it('callsSinceWarning >= DEBOUNCE_COUNT → fire', () => {
    assert.equal(shouldFireWarning(5, 'WARNING', null), true)
    assert.equal(shouldFireWarning(10, 'WARNING', null), true)
  })

  it('escalation WARNING→CRITICAL fires immediately', () => {
    assert.equal(shouldFireWarning(1, 'CRITICAL', 'WARNING'), true)
    assert.equal(shouldFireWarning(0, 'CRITICAL', 'WARNING'), true)
  })

  it('CRITICAL→CRITICAL does not bypass debounce', () => {
    assert.equal(shouldFireWarning(2, 'CRITICAL', 'CRITICAL'), false)
  })
})

describe('DEBOUNCE_COUNT and BRIDGE_STALE_MS', () => {
  it('DEBOUNCE_COUNT is 5', () => {
    assert.equal(DEBOUNCE_COUNT, 5)
  })

  it('BRIDGE_STALE_MS is 60000', () => {
    assert.equal(BRIDGE_STALE_MS, 60_000)
  })
})
