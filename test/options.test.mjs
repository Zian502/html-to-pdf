import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'
import { parseArguments } from '../src/options.mjs'

test('uses stable defaults', () => {
  const options = parseArguments(['--', 'report.html'])

  assert.equal(options.input, 'report.html')
  assert.equal(options.output, path.resolve('output.pdf'))
  assert.equal(options.format, 'A4')
  assert.equal(options.media, 'screen')
  assert.deepEqual(options.viewport, { width: 1440, height: 900 })
  assert.equal(options.printBackground, true)
  assert.equal(options.safe, false)
})

test('parses custom rendering options', () => {
  const options = parseArguments([
    'report.html',
    'report.pdf',
    '--width',
    '1440px',
    '--height',
    '900px',
    '--viewport',
    '1280x720',
    '--landscape',
    '--no-background',
  ])

  assert.equal(options.width, '1440px')
  assert.equal(options.height, '900px')
  assert.deepEqual(options.viewport, { width: 1280, height: 720 })
  assert.equal(options.landscape, true)
  assert.equal(options.printBackground, false)
})

test('requires custom width and height together', () => {
  assert.throws(
    () => parseArguments(['report.html', '--width', '1440px']),
    /must be provided together/,
  )
})

test('supports full-page rendering', () => {
  const options = parseArguments(['report.html', '--full-page'])

  assert.equal(options.fullPage, true)
})

test('supports safe rendering for untrusted HTML', () => {
  const options = parseArguments(['report.html', '--safe'])

  assert.equal(options.safe, true)
})

test('rejects full-page with a custom paper size', () => {
  assert.throws(
    () =>
      parseArguments([
        'report.html',
        '--full-page',
        '--width',
        '1440px',
        '--height',
        '900px',
      ]),
    /cannot be combined/,
  )
})

test('rejects unsafe CSS length values', () => {
  assert.throws(
    () =>
      parseArguments([
        'report.html',
        '--width',
        '100px; color: red',
        '--height',
        '900px',
      ]),
    /must be a non-negative length/,
  )
})
