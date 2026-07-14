import { spawn } from 'node:child_process'
import { createReadStream } from 'node:fs'
import fs from 'node:fs/promises'
import http from 'node:http'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(SERVER_DIR, '..')
const PUBLIC_DIR = path.join(PROJECT_ROOT, 'public')
const CLI_PATH = path.join(PROJECT_ROOT, 'src', 'cli.mjs')
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
const MAX_ACTIVE_CONVERSIONS = 2
const VALID_MODES = new Set(['full-page', 'A4', 'A3', 'Letter'])
const PDF_ID_PATTERN = /^[a-z0-9-]+$/

const STATIC_FILES = new Map([
  [
    '/',
    {
      path: path.join(PUBLIC_DIR, 'index.html'),
      type: 'text/html; charset=utf-8',
    },
  ],
  [
    '/app.js',
    {
      path: path.join(PUBLIC_DIR, 'app.js'),
      type: 'text/javascript; charset=utf-8',
    },
  ],
  [
    '/styles.css',
    {
      path: path.join(PUBLIC_DIR, 'styles.css'),
      type: 'text/css; charset=utf-8',
    },
  ],
  [
    '/vendor/lucide.js',
    {
      path: path.join(
        PROJECT_ROOT,
        'node_modules',
        'lucide',
        'dist',
        'umd',
        'lucide.js',
      ),
      type: 'text/javascript; charset=utf-8',
    },
  ],
])

export async function createApp({
  storageRoot = path.join(PROJECT_ROOT, 'runtime'),
  converter = runCliConverter,
  maxUploadBytes = MAX_UPLOAD_BYTES,
} = {}) {
  const directories = {
    uploads: path.join(storageRoot, 'uploads'),
    pdfs: path.join(storageRoot, 'pdfs'),
    metadata: path.join(storageRoot, 'metadata'),
  }

  await Promise.all(
    Object.values(directories).map((directory) =>
      fs.mkdir(directory, { recursive: true }),
    ),
  )

  let activeConversions = 0

  return http.createServer(async (request, response) => {
    setSecurityHeaders(response)

    try {
      const url = new URL(request.url ?? '/', 'http://localhost')

      if (request.method === 'GET' && url.pathname === '/health') {
        sendJson(response, 200, { status: 'ok' })
        return
      }

      if (request.method === 'GET' && STATIC_FILES.has(url.pathname)) {
        await serveStaticFile(response, STATIC_FILES.get(url.pathname))
        return
      }

      if (request.method === 'GET' && url.pathname === '/api/pdfs') {
        sendJson(response, 200, { items: await listPdfRecords(directories) })
        return
      }

      const pdfRoute = /^\/api\/pdfs\/([^/]+)(\/download)?$/.exec(url.pathname)
      if (request.method === 'GET' && pdfRoute) {
        await servePdf(response, directories, pdfRoute[1], Boolean(pdfRoute[2]))
        return
      }

      if (request.method === 'POST' && url.pathname === '/api/pdfs') {
        if (activeConversions >= MAX_ACTIVE_CONVERSIONS) {
          sendJson(response, 429, { error: '转换任务繁忙，请稍后重试。' })
          return
        }

        activeConversions += 1
        try {
          const record = await convertUpload({
            request,
            url,
            directories,
            converter,
            maxUploadBytes,
          })
          sendJson(response, 201, { item: record })
        } finally {
          activeConversions -= 1
        }
        return
      }

      sendJson(response, 404, { error: '接口不存在。' })
    } catch (error) {
      const status = Number.isInteger(error.statusCode) ? error.statusCode : 500
      const message =
        status >= 500 ? '转换失败，请检查 HTML 内容或服务日志。' : error.message
      if (status >= 500) console.error(error)
      sendJson(response, status, { error: message })
    }
  })
}

async function convertUpload({
  request,
  url,
  directories,
  converter,
  maxUploadBytes,
}) {
  const sourceName = normalizeUploadName(url.searchParams.get('filename'))
  const mode = url.searchParams.get('mode') ?? 'full-page'
  const landscape = url.searchParams.get('landscape') === 'true'

  if (!VALID_MODES.has(mode)) {
    throw httpError(400, '不支持的页面格式。')
  }

  const body = await readBody(request, maxUploadBytes)
  if (body.length === 0) {
    throw httpError(400, 'HTML 文件不能为空。')
  }

  const id = `${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`
  const inputPath = path.join(directories.uploads, `${id}.html`)
  const outputPath = path.join(directories.pdfs, `${id}.pdf`)
  const metadataPath = path.join(directories.metadata, `${id}.json`)
  const displayName = `${path.basename(sourceName, path.extname(sourceName))}.pdf`

  await fs.writeFile(inputPath, body)

  try {
    await converter({ inputPath, outputPath, mode, landscape })
    const stats = await fs.stat(outputPath)
    const record = {
      id,
      name: displayName,
      sourceName,
      mode,
      landscape: mode === 'full-page' ? false : landscape,
      size: stats.size,
      createdAt: new Date().toISOString(),
      viewUrl: `/api/pdfs/${id}`,
      downloadUrl: `/api/pdfs/${id}/download`,
    }
    await fs.writeFile(metadataPath, JSON.stringify(record, null, 2))
    return record
  } catch (error) {
    await Promise.all([
      fs.rm(outputPath, { force: true }),
      fs.rm(metadataPath, { force: true }),
    ])
    throw error
  } finally {
    await fs.rm(inputPath, { force: true })
  }
}

async function runCliConverter({ inputPath, outputPath, mode, landscape }) {
  const argumentsList = [CLI_PATH, inputPath, outputPath, '--safe']
  if (mode === 'full-page') {
    argumentsList.push('--full-page')
  } else {
    argumentsList.push('--format', mode)
    if (landscape) argumentsList.push('--landscape')
  }

  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, argumentsList, {
      cwd: PROJECT_ROOT,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let output = ''

    const appendOutput = (chunk) => {
      output = `${output}${chunk}`.slice(-32_000)
    }

    child.stdout.on('data', appendOutput)
    child.stderr.on('data', appendOutput)
    child.once('error', reject)
    child.once('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`CLI exited with code ${code}.\n${output}`))
    })
  })
}

async function listPdfRecords(directories) {
  const entries = await fs.readdir(directories.metadata, {
    withFileTypes: true,
  })
  const records = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .map(async (entry) => {
        try {
          const record = JSON.parse(
            await fs.readFile(
              path.join(directories.metadata, entry.name),
              'utf8',
            ),
          )
          await fs.access(path.join(directories.pdfs, `${record.id}.pdf`))
          return record
        } catch {
          return null
        }
      }),
  )

  return records
    .filter(Boolean)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
}

async function servePdf(response, directories, id, download) {
  if (!PDF_ID_PATTERN.test(id)) throw httpError(404, 'PDF 不存在。')

  const metadataPath = path.join(directories.metadata, `${id}.json`)
  const pdfPath = path.join(directories.pdfs, `${id}.pdf`)

  let record
  let stats
  try {
    ;[record, stats] = await Promise.all([
      fs.readFile(metadataPath, 'utf8').then(JSON.parse),
      fs.stat(pdfPath),
    ])
  } catch {
    throw httpError(404, 'PDF 不存在。')
  }

  const disposition = download ? 'attachment' : 'inline'
  response.writeHead(200, {
    'Content-Type': 'application/pdf',
    'Content-Length': stats.size,
    'Content-Disposition': buildContentDisposition(disposition, record.name),
    'Cache-Control': 'private, max-age=0, must-revalidate',
  })
  createReadStream(pdfPath).pipe(response)
}

async function serveStaticFile(response, file) {
  try {
    const stats = await fs.stat(file.path)
    response.writeHead(200, {
      'Content-Type': file.type,
      'Content-Length': stats.size,
      'Cache-Control': 'no-cache',
    })
    createReadStream(file.path).pipe(response)
  } catch {
    throw httpError(404, '页面资源不存在。')
  }
}

function normalizeUploadName(value) {
  const decoded = value?.trim() || 'document.html'
  const name = path.basename(decoded).replace(/[\u0000-\u001f\u007f]/g, '')
  if (!/\.html?$/i.test(name))
    throw httpError(400, '仅支持 .html 或 .htm 文件。')
  return name.slice(0, 180)
}

function readBody(request, limit) {
  const declaredLength = Number(request.headers['content-length'] ?? 0)
  if (declaredLength > limit)
    return Promise.reject(httpError(413, 'HTML 文件不能超过 10 MB。'))

  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    let limitExceeded = false

    request.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) {
        limitExceeded = true
        return
      }
      chunks.push(chunk)
    })
    request.once('end', () => {
      if (limitExceeded) reject(httpError(413, 'HTML 文件不能超过 10 MB。'))
      else resolve(Buffer.concat(chunks))
    })
    request.once('error', reject)
  })
}

function setSecurityHeaders(response) {
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('X-Frame-Options', 'SAMEORIGIN')
  response.setHeader('Referrer-Policy', 'no-referrer')
  response.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; frame-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'",
  )
}

function sendJson(response, status, payload) {
  if (response.headersSent) return
  const body = JSON.stringify(payload)
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  })
  response.end(body)
}

function buildContentDisposition(type, filename) {
  const asciiName =
    filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_') ||
    'document.pdf'
  return `${type}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(filename)}`
}

function httpError(statusCode, message) {
  return Object.assign(new Error(message), { statusCode })
}
