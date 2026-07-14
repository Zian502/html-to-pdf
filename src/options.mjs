import path from 'node:path'

export const HELP_TEXT = `
Usage:
  html-to-pdf <input> [output] [options]

Arguments:
  input                       Local HTML file or http(s) URL
  output                      Output PDF path (default: output.pdf)

Options:
  --format <name>             Paper format: A4, A3, Letter, etc. (default: A4)
  --width <size>              Custom paper width, for example 1440px or 210mm
  --height <size>             Custom paper height, for example 900px or 297mm
  --landscape                 Use landscape orientation
  --margin <size>             Set all margins (default: 0)
  --viewport <width>x<height> Browser viewport (default: 1440x900)
  --media <screen|print>      CSS media type (default: screen)
  --wait-for <selector>       Wait for an element before rendering
  --delay <milliseconds>      Extra delay after the page is ready (default: 0)
  --css <path>                Inject an additional CSS file
  --timeout <milliseconds>    Navigation/render timeout (default: 60000)
  --header-footer             Include Chromium header and footer
  --no-background             Do not print background graphics
  --help                      Show this help

Examples:
  html-to-pdf ./report.html ./report.pdf
  html-to-pdf https://example.com/report ./report.pdf --format A4
  html-to-pdf ./dashboard.html ./dashboard.pdf --width 1440px --height 900px
  html-to-pdf ./report.html ./report.pdf --wait-for "[data-ready=true]" --delay 500
`.trim()

const optionsWithValue = new Set([
  '--format',
  '--width',
  '--height',
  '--margin',
  '--viewport',
  '--media',
  '--wait-for',
  '--delay',
  '--css',
  '--timeout',
])

export function parseArguments(argv) {
  const positionals = []
  const values = new Map()
  const flags = new Set()

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]

    if (argument === '--') {
      continue
    }

    if (!argument.startsWith('--')) {
      positionals.push(argument)
      continue
    }

    if (optionsWithValue.has(argument)) {
      const value = argv[index + 1]
      if (!value || value.startsWith('--')) {
        throw new Error(`${argument} requires a value`)
      }
      values.set(argument, value)
      index += 1
      continue
    }

    if (['--landscape', '--header-footer', '--no-background', '--help'].includes(argument)) {
      flags.add(argument)
      continue
    }

    throw new Error(`Unknown option: ${argument}`)
  }

  if (flags.has('--help')) {
    return { help: true }
  }

  if (positionals.length === 0) {
    throw new Error('Input HTML file or URL is required')
  }

  if (positionals.length > 2) {
    throw new Error('Too many positional arguments')
  }

  const viewport = parseViewport(values.get('--viewport') ?? '1440x900')
  const delay = parseNonNegativeInteger(values.get('--delay') ?? '0', '--delay')
  const timeout = parseNonNegativeInteger(values.get('--timeout') ?? '60000', '--timeout')
  const width = values.get('--width')
  const height = values.get('--height')

  if (Boolean(width) !== Boolean(height)) {
    throw new Error('--width and --height must be provided together')
  }

  const media = values.get('--media') ?? 'screen'
  if (!['screen', 'print'].includes(media)) {
    throw new Error('--media must be either screen or print')
  }

  return {
    help: false,
    input: positionals[0],
    output: path.resolve(positionals[1] ?? 'output.pdf'),
    format: values.get('--format') ?? 'A4',
    width,
    height,
    landscape: flags.has('--landscape'),
    margin: values.get('--margin') ?? '0',
    viewport,
    media,
    waitFor: values.get('--wait-for'),
    delay,
    cssPath: values.get('--css'),
    timeout,
    displayHeaderFooter: flags.has('--header-footer'),
    printBackground: !flags.has('--no-background'),
  }
}

function parseViewport(value) {
  const match = /^(\d+)x(\d+)$/i.exec(value)
  if (!match) {
    throw new Error('--viewport must use the format WIDTHxHEIGHT, for example 1440x900')
  }

  const width = Number(match[1])
  const height = Number(match[2])
  if (width < 1 || height < 1) {
    throw new Error('--viewport dimensions must be positive integers')
  }

  return { width, height }
}

function parseNonNegativeInteger(value, option) {
  if (!/^\d+$/.test(value)) {
    throw new Error(`${option} must be a non-negative integer`)
  }
  return Number(value)
}
