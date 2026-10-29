// Small WebSocket client for friend rooms. The server is authoritative; the
// client only sends input and receives room state + match snapshots.

export class NetClient {
  constructor(handlers = {}) {
    this.handlers = handlers
    this.ws = null
    this.open = false
    this.side = 0
    this.code = null
    this.closedByUs = false
    this.pending = []
  }

  connect() {
    if (this.ws) return
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
    const url = `${proto}//${location.host}/ws`
    this.ws = new WebSocket(url)
    this.ws.onopen = () => {
      this.open = true
      for (const msg of this.pending) this.send(msg)
      this.pending = []
      this.handlers.onOpen?.()
    }
    this.ws.onmessage = (ev) => {
      let msg
      try { msg = JSON.parse(ev.data) } catch { return }
      if (msg.t === 'created' || msg.t === 'joined') {
        this.side = msg.side || 0
        this.code = msg.code
      }
      this.handlers.onMessage?.(msg)
    }
    this.ws.onclose = () => {
      this.open = false
      if (!this.closedByUs) this.handlers.onClose?.()
    }
    this.ws.onerror = () => {
      this.handlers.onError?.()
    }
  }

  send(msg) {
    if (this.ws && this.ws.readyState === 1) {
      try { this.ws.send(JSON.stringify(msg)) } catch {}
    } else {
      this.pending.push(msg)
      this.connect()
    }
  }

  createRoom() { this.connect(); this.send({ t: 'create' }) }
  joinRoom(code) { this.connect(); this.send({ t: 'join', code: String(code || '').toUpperCase() }) }
  pick(char, stage) { this.send({ t: 'pick', char, stage }) }
  stage(stage) { this.send({ t: 'stage', stage }) }
  ready() { this.send({ t: 'ready' }) }
  rematch() { this.send({ t: 'rematch' }) }
  sendInput(input) { this.send({ t: 'input', input }) }
  leave() {
    this.closedByUs = true
    this.send({ t: 'leave' })
    try { this.ws?.close() } catch {}
    this.ws = null
    this.open = false
  }
  close() { this.leave() }
}
