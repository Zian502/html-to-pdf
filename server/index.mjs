import { createApp } from './app.mjs'

const port = parsePort(process.env.PORT ?? '4173')
const host = process.env.HOST ?? '127.0.0.1'
const server = await createApp()

server.listen(port, host, () => {
  console.log(`HTML to PDF is running at http://${host}:${port}`)
})

function parsePort(value) {
  const port = Number(value)
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535')
  }
  return port
}
