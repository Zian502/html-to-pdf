import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from 'playwright'

const STABLE_RENDER_CSS = `
  *, *::before, *::after {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    animation: none !important;
    transition: none !important;
    caret-color: transparent !important;
  }
`

export async function renderPdf(options) {
  const inputUrl = await resolveInput(options.input)
  await fs.mkdir(path.dirname(options.output), { recursive: true })

  const { browser, browserName } = await launchBrowser()

  try {
    const context = await browser.newContext({
      viewport: options.viewport,
      deviceScaleFactor: 1,
    })
    const page = await context.newPage()
    page.setDefaultTimeout(options.timeout)

    const failedRequests = []
    page.on('requestfailed', request => {
      failedRequests.push({
        url: request.url(),
        error: request.failure()?.errorText ?? 'unknown error',
      })
    })

    await page.goto(inputUrl, {
      waitUntil: 'networkidle',
      timeout: options.timeout,
    })

    await page.emulateMedia({ media: options.media })
    await page.addStyleTag({ content: STABLE_RENDER_CSS })

    if (options.cssPath) {
      await page.addStyleTag({ path: path.resolve(options.cssPath) })
    }

    if (options.waitFor) {
      await page.locator(options.waitFor).waitFor({ state: 'visible' })
    }

    await page.evaluate(async () => {
      await document.fonts.ready

      await Promise.all(
        [...document.images].map(image => {
          if (image.complete) return undefined
          return new Promise(resolve => {
            image.addEventListener('load', resolve, { once: true })
            image.addEventListener('error', resolve, { once: true })
          })
        }),
      )
    })

    if (options.delay > 0) {
      await page.waitForTimeout(options.delay)
    }

    const pdfOptions = {
      path: options.output,
      landscape: options.landscape,
      printBackground: options.printBackground,
      preferCSSPageSize: false,
      displayHeaderFooter: options.displayHeaderFooter,
      margin: {
        top: options.margin,
        right: options.margin,
        bottom: options.margin,
        left: options.margin,
      },
    }

    if (options.fullPage) {
      const pageSize = await page.evaluate(() => ({
        width: Math.max(
          document.documentElement.scrollWidth,
          document.body?.scrollWidth ?? 0,
        ),
        height: Math.max(
          document.documentElement.scrollHeight,
          document.body?.scrollHeight ?? 0,
        ),
      }))

      await page.addStyleTag({
        content: `@page { size: ${pageSize.width}px ${pageSize.height}px; margin: ${options.margin}; }`,
      })
      pdfOptions.width = `${pageSize.width}px`
      pdfOptions.height = `${pageSize.height}px`
      pdfOptions.preferCSSPageSize = true
    } else if (options.width && options.height) {
      await page.addStyleTag({
        content: `@page { size: ${options.width} ${options.height}; margin: ${options.margin}; }`,
      })
      pdfOptions.width = options.width
      pdfOptions.height = options.height
      pdfOptions.preferCSSPageSize = true
    } else {
      pdfOptions.format = options.format
    }

    await page.pdf(pdfOptions)
    await context.close()

    return { inputUrl, failedRequests, browserName }
  } finally {
    await browser.close()
  }
}

async function launchBrowser() {
  try {
    return {
      browser: await chromium.launch({ headless: true }),
      browserName: 'Playwright Chromium',
    }
  } catch (error) {
    const missingBrowser =
      error.message.includes('Executable doesn\'t exist') ||
      error.message.includes('browserType.launch: Executable')

    if (!missingBrowser) {
      throw error
    }

    return {
      browser: await chromium.launch({ headless: true, channel: 'chrome' }),
      browserName: 'Google Chrome',
    }
  }
}

async function resolveInput(input) {
  if (/^https?:\/\//i.test(input)) {
    return input
  }

  const inputPath = path.resolve(input)
  const stats = await fs.stat(inputPath).catch(() => null)

  if (!stats?.isFile()) {
    throw new Error(`HTML file not found: ${inputPath}`)
  }

  return pathToFileURL(inputPath).href
}
