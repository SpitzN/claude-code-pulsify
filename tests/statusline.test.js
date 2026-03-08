'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

const { sanitizeId, normalizeUsage, getBarColor, buildProgressBar, getActiveTask, formatCost } = require('../lib/statusline')

// ANSI color constants (mirrored from source)
const ESC = '\x1b['
const FG = (r, g, b) => `${ESC}38;2;${r};${g};${b}m`
const GREEN = FG(80, 200, 80)
const YELLOW = FG(220, 200, 60)
const ORANGE = FG(230, 140, 40)
const RED = FG(220, 60, 60)

describe('sanitizeId', () => {
  it('passes through normal id', () => {
    assert.equal(sanitizeId('abc-123_def'), 'abc-123_def')
  })

  it('strips special characters', () => {
    assert.equal(sanitizeId('abc/def@ghi!'), 'abcdefghi')
  })

  it('handles empty string', () => {
    assert.equal(sanitizeId(''), '')
  })
})

describe('normalizeUsage', () => {
  it('100 (empty context) → 0% used', () => {
    assert.equal(normalizeUsage(100), 0)
  })

  it('16.5 (autocompact threshold) → 100% used', () => {
    assert.equal(normalizeUsage(16.5), 100)
  })

  it('58.25 (midpoint) → 50% used', () => {
    assert.equal(normalizeUsage(58.25), 50)
  })

  it('0 (fully exhausted) → 100% used', () => {
    assert.equal(normalizeUsage(0), 100)
  })

  it('values below autocompact threshold clamp to 100%', () => {
    assert.equal(normalizeUsage(10), 100)
    assert.equal(normalizeUsage(5), 100)
  })
})

describe('getBarColor', () => {
  it('<50 → GREEN', () => {
    assert.equal(getBarColor(0), GREEN)
    assert.equal(getBarColor(49), GREEN)
  })

  it('50-64 → YELLOW', () => {
    assert.equal(getBarColor(50), YELLOW)
    assert.equal(getBarColor(64), YELLOW)
  })

  it('65-79 → ORANGE', () => {
    assert.equal(getBarColor(65), ORANGE)
    assert.equal(getBarColor(79), ORANGE)
  })

  it('≥80 → RED', () => {
    assert.equal(getBarColor(80), RED)
    assert.equal(getBarColor(100), RED)
  })
})

describe('buildProgressBar', () => {
  it('0% → all empty segments', () => {
    const bar = buildProgressBar(0)
    assert.ok(!bar.includes('█'))
    assert.ok(bar.includes('░'))
  })

  it('100% → all filled segments', () => {
    const bar = buildProgressBar(100)
    assert.ok(bar.includes('█'))
    assert.ok(!bar.includes('░'))
  })

  it('50% → mixed filled and empty', () => {
    const bar = buildProgressBar(50)
    assert.ok(bar.includes('█'))
    assert.ok(bar.includes('░'))
  })

  it('includes BOLD at ≥80%', () => {
    const BOLD = `${ESC}1m`
    const bar80 = buildProgressBar(80)
    assert.ok(bar80.includes(BOLD))
    const bar50 = buildProgressBar(50)
    // BOLD appears in pctLabel always, but emphasis BOLD wraps the filled bar only at ≥80
    // Check that filled bar portion has bold
    const filledSection80 = bar80.split('░')[0]
    assert.ok(filledSection80.includes(BOLD))
  })

  it('includes percentage label', () => {
    const bar = buildProgressBar(73)
    assert.ok(bar.includes('73%'))
  })
})

describe('getActiveTask', () => {
  it('no todos → null', () => {
    assert.equal(getActiveTask({}), null)
    assert.equal(getActiveTask({ todos: [] }), null)
  })

  it('finds in_progress task', () => {
    const data = {
      todos: [
        { status: 'pending', content: 'Pending task' },
        { status: 'in_progress', content: 'Active task' },
      ],
    }
    assert.equal(getActiveTask(data), 'Active task')
  })

  it('falls back to pending when no in_progress', () => {
    const data = {
      todos: [{ status: 'pending', content: 'Pending task' }],
    }
    assert.equal(getActiveTask(data), 'Pending task')
  })

  it('truncates at 40 chars', () => {
    const long = 'A'.repeat(50)
    const data = { todos: [{ status: 'in_progress', content: long }] }
    const result = getActiveTask(data)
    assert.equal(result.length, 40)
    assert.ok(result.endsWith('...'))
  })

  it('does not truncate at exactly 40 chars', () => {
    const exact = 'A'.repeat(40)
    const data = { todos: [{ status: 'in_progress', content: exact }] }
    assert.equal(getActiveTask(data), exact)
  })
})

describe('formatCost', () => {
  it('0 → empty string', () => {
    assert.equal(formatCost(0), '')
  })

  it('null → empty string', () => {
    assert.equal(formatCost(null), '')
  })

  it('undefined → empty string', () => {
    assert.equal(formatCost(undefined), '')
  })

  it('<$1 strips trailing zeros', () => {
    const result = formatCost(0.5)
    assert.ok(result.includes('$0.5'))
    assert.ok(!result.includes('$0.50'))
  })

  it('<$1 with no trailing zeros', () => {
    const result = formatCost(0.37)
    assert.ok(result.includes('$0.37'))
  })

  it('≥$1 formatting', () => {
    const result = formatCost(2.5)
    assert.ok(result.includes('$2.5'))
  })

  it('exact $1.0 → "$1"', () => {
    const result = formatCost(1.0)
    assert.ok(result.includes('$1'))
    assert.ok(!result.includes('$1.0'))
  })
})
