import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createApp } from '../server/app.mjs'

test('uploads HTML, invokes the converter, and serves the PDF', async (t) => {
  const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'html-to-pdf-'))
  t.after(() => fs.rm(storageRoot, { recursive: true, force: true }))

  const converterCalls = []
  const server = await createApp({
    storageRoot,
    converter: async (options) => {
      converterCalls.push(options)
      await fs.writeFile(options.outputPath, '%PDF-1.4\nserver-test')
    },
  })
  await listen(server)
  t.after(() => closeServer(server))
  const baseUrl = `http://127.0.0.1:${server.address().port}`

  const home = await fetch(baseUrl)
  assert.equal(home.status, 200)
  assert.match(await home.text(), /HTML to PDF/)

  const health = await fetch(`${baseUrl}/health`)
  assert.equal(health.status, 200)
  assert.deepEqual(await health.json(), { status: 'ok' })

  const icons = await fetch(`${baseUrl}/vendor/lucide.js`)
  assert.equal(icons.status, 200)
  assert.match(icons.headers.get('content-type'), /javascript/)

  const upload = await fetch(
    `${baseUrl}/api/pdfs?filename=demo.html&mode=full-page`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'text/html' },
      body: '<!doctype html><title>Demo</title>',
    },
  )
  assert.equal(upload.status, 201)
  const uploaded = await upload.json()
  assert.equal(uploaded.item.name, 'demo.pdf')
  assert.equal(converterCalls.length, 1)
  assert.equal(converterCalls[0].mode, 'full-page')

  const list = await fetch(`${baseUrl}/api/pdfs`).then((response) =>
    response.json(),
  )
  assert.equal(list.items.length, 1)
  assert.equal(list.items[0].id, uploaded.item.id)

  const pdfResponse = await fetch(`${baseUrl}${uploaded.item.viewUrl}`)
  assert.equal(pdfResponse.status, 200)
  assert.equal(pdfResponse.headers.get('content-type'), 'application/pdf')
  assert.match(await pdfResponse.text(), /^%PDF-/)

  const download = await fetch(`${baseUrl}${uploaded.item.downloadUrl}`)
  assert.match(download.headers.get('content-disposition'), /^attachment;/)

  const deletion = await fetch(`${baseUrl}/api/pdfs/${uploaded.item.id}`, {
    method: 'DELETE',
  })
  assert.equal(deletion.status, 200)
  assert.deepEqual(await deletion.json(), { id: uploaded.item.id })

  const listAfterDeletion = await fetch(`${baseUrl}/api/pdfs`).then(
    (response) => response.json(),
  )
  assert.equal(listAfterDeletion.items.length, 0)
  assert.equal((await fetch(`${baseUrl}${uploaded.item.viewUrl}`)).status, 404)
  assert.equal(
    (
      await fetch(`${baseUrl}/api/pdfs/${uploaded.item.id}`, {
        method: 'DELETE',
      })
    ).status,
    404,
  )
})

test('rejects unsupported files and oversized bodies', async (t) => {
  const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'html-to-pdf-'))
  t.after(() => fs.rm(storageRoot, { recursive: true, force: true }))

  const server = await createApp({ storageRoot, maxUploadBytes: 10 })
  await listen(server)
  t.after(() => closeServer(server))
  const baseUrl = `http://127.0.0.1:${server.address().port}`

  const wrongType = await fetch(`${baseUrl}/api/pdfs?filename=demo.txt`, {
    method: 'POST',
    body: 'text',
  })
  assert.equal(wrongType.status, 400)

  const oversized = await fetch(`${baseUrl}/api/pdfs?filename=demo.html`, {
    method: 'POST',
    body: '01234567890',
  })
  assert.equal(oversized.status, 413)
})

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
}

function closeServer(server) {
  server.closeAllConnections()
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error)
      else resolve()
    })
  })
}
