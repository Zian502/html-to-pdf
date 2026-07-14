#!/usr/bin/env node

import { HELP_TEXT, parseArguments } from './options.mjs'
import { renderPdf } from './render.mjs'

async function main() {
  const options = parseArguments(process.argv.slice(2))

  if (options.help) {
    console.log(HELP_TEXT)
    return
  }

  console.log(`Rendering ${options.input}`)
  const result = await renderPdf(options)
  console.log(`Browser: ${result.browserName}`)
  console.log(`PDF created: ${options.output}`)

  if (result.failedRequests.length > 0) {
    console.warn(`Warning: ${result.failedRequests.length} resource request(s) failed:`)
    for (const request of result.failedRequests.slice(0, 10)) {
      console.warn(`  ${request.error}: ${request.url}`)
    }
  }
}

main().catch(error => {
  console.error(`Error: ${error.message}`)
  process.exitCode = 1
})
