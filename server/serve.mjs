// Production server: serves the built app and hosts the friend-room WebSocket.
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { attachRoomServer } from './roomServer.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..', 'dist')
const port = Number(process.env.PORT || 4180)

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
  '.mp3': 'audio/mpeg',
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost')
  let file = path.join(root, decodeURIComponent(url.pathname))
  if (url.pathname === '/' || !path.extname(file)) file = path.join(root, 'index.html')
  if (!file.startsWith(root)) { res.writeHead(403); res.end('Forbidden'); return }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' })
    res.end(data)
  })
})

attachRoomServer(server)
server.listen(port, () => {
  console.log(`Sansad Showdown on http://localhost:${port} (rooms at /ws)`)
})
