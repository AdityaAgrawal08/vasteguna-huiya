import { defineConfig } from 'vite'
import { attachRoomServer } from './server/roomServer.js'

function roomServerPlugin() {
  const attach = (server) => {
    if (!server.httpServer || server.httpServer.__roomsAttached) return
    server.httpServer.__roomsAttached = true
    attachRoomServer(server.httpServer)
  }
  return {
    name: 'sansad-room-server',
    configureServer: attach,
    configurePreviewServer: attach,
  }
}

export default defineConfig({
  server: { port: 4173, host: '0.0.0.0' },
  preview: { port: 4173, host: '0.0.0.0' },
  build: { target: 'es2020', assetsInlineLimit: 0 },
  plugins: [roomServerPlugin()],
})
