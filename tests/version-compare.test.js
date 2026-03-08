'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

// Test the localeCompare version comparison pattern used in check-update-worker.js
function isUpdateAvailable(installed, latest) {
  return latest.localeCompare(installed, undefined, { numeric: true }) > 0
}

describe('version comparison (localeCompare with numeric)', () => {
  it('"1.0.0" vs "1.0.1" → update available', () => {
    assert.equal(isUpdateAvailable('1.0.0', '1.0.1'), true)
  })

  it('"1.1.0" vs "1.0.9" → no update', () => {
    assert.equal(isUpdateAvailable('1.1.0', '1.0.9'), false)
  })

  it('"1.0.0" vs "1.0.0" → no update (same version)', () => {
    assert.equal(isUpdateAvailable('1.0.0', '1.0.0'), false)
  })

  it('"1.0.0" vs "2.0.0" → update available (major bump)', () => {
    assert.equal(isUpdateAvailable('1.0.0', '2.0.0'), true)
  })

  it('"1.9.9" vs "1.10.0" → update available (numeric comparison)', () => {
    assert.equal(isUpdateAvailable('1.9.9', '1.10.0'), true)
  })

  it('"2.0.0" vs "1.9.9" → no update (downgrade)', () => {
    assert.equal(isUpdateAvailable('2.0.0', '1.9.9'), false)
  })

  it('"0.9.0" vs "0.10.0" → update available (numeric across minor)', () => {
    assert.equal(isUpdateAvailable('0.9.0', '0.10.0'), true)
  })

  it('"1.0.0" vs "1.0.0-beta" → localeCompare treats hyphen suffix as greater', () => {
    // Note: localeCompare with numeric considers "1.0.0-beta" > "1.0.0"
    // This is a known quirk — semver pre-release ordering isn't supported
    assert.equal(isUpdateAvailable('1.0.0', '1.0.0-beta'), true)
  })
})
