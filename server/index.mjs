import { createApp } from './app.mjs'

const port = parsePort(process.env.PORT ?? '4173')
const host = process.env.HOST ?? '127.0.0.1'
const server = await createApp({ storageRoot: process.env.STORAGE_ROOT })

server.listen(port, host, () => {
  console.log(`HTML to PDF is running at http://${host}:${port}`)
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    server.close(() => process.exit(0))
  })
}

function parsePort(value) {
  const port = Number(value)
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535')
  }
  return port
}
