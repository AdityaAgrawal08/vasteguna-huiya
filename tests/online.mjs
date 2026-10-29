import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'

const PORT = 4178
const EXTERNAL = process.env.ONLINE_URL || ''
const URL = EXTERNAL || `http://127.0.0.1:${PORT}/?quality=low`
const server = EXTERNAL ? null : spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
  cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'], detached: true,
})
let serverLog = ''
if (server) {
  server.stdout.on('data', (d) => { serverLog += d })
  server.stderr.on('data', (d) => { serverLog += d })
}

for (let i = 0; i < 100; i++) {
  try { if ((await fetch(URL)).ok) break } catch {}
  await sleep(200)
}

const errors = []
let hostBrowser, guestBrowser
try {
  const launch = () => chromium.launch({
    executablePath: '/usr/bin/chromium',
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'],
  })
  hostBrowser = await launch()
  guestBrowser = await launch()
  const host = await hostBrowser.newPage({ viewport: { width: 1280, height: 720 } })
  const guest = await guestBrowser.newPage({ viewport: { width: 1280, height: 720 } })
  for (const [name, page] of [['host', host], ['guest', guest]]) {
    page.on('pageerror', (e) => errors.push(`${name} pageerror: ${e.message}`))
    page.on('console', (m) => {
      if (m.type() !== 'error') return
      const text = m.text()
      if (text.includes('Failed to load resource')) return
      errors.push(`${name} console: ${text}`)
    })
  }

  await host.goto(URL, { waitUntil: 'domcontentloaded' })
  await host.waitForSelector('#title:not(.hidden)', { timeout: 60000 })
  await host.keyboard.press('Enter')
  await host.waitForSelector('#select:not(.hidden)')
  await host.click('#online-btn')
  await host.waitForSelector('#online:not(.hidden)')
  await host.click('#on-host')
  await host.waitForSelector('#on-hosting:not(.hidden)')
  const code = await host.textContent('#on-room-code')
  if (!/^[A-Z0-9]{6}$/.test(code)) throw new Error('bad room code: ' + code)

  await guest.goto(URL, { waitUntil: 'domcontentloaded' })
  await guest.waitForSelector('#title:not(.hidden)', { timeout: 60000 })
  await guest.keyboard.press('Enter')
  await guest.waitForSelector('#select:not(.hidden)')
  await guest.click('#online-btn')
  await guest.waitForSelector('#online:not(.hidden)')
  await guest.fill('#on-code', code)
  await guest.click('#on-join-form button[type="submit"]')

  await host.waitForSelector('#select:not(.hidden)', { timeout: 15000 })
  await guest.waitForSelector('#select:not(.hidden)', { timeout: 15000 })
  await host.waitForFunction(() => window.__SANSAD__.netRoom?.code, { timeout: 10000 })
  await guest.waitForFunction(() => window.__SANSAD__.netRoom?.code, { timeout: 10000 })

  await host.click('[data-tile="modi"]')
  await guest.click('[data-tile="rahul"]')
  await host.waitForFunction(() => window.__SANSAD__.netRoom?.hostChar === 'modi' && window.__SANSAD__.netRoom?.guestChar === 'rahul', { timeout: 10000 })
  await guest.waitForFunction(() => window.__SANSAD__.netRoom?.hostChar === 'modi' && window.__SANSAD__.netRoom?.guestChar === 'rahul', { timeout: 10000 })

  for (let attempt = 0; attempt < 3; attempt++) {
    await host.click('#fight-btn').catch(() => {})
    await guest.click('#fight-btn').catch(() => {})
    try {
      await host.waitForSelector('#hud:not(.hidden)', { timeout: 6000 })
      break
    } catch {}
  }
  await host.waitForSelector('#hud:not(.hidden)', { timeout: 10000 })
  await guest.waitForSelector('#hud:not(.hidden)', { timeout: 10000 })
  await host.waitForFunction(() => window.__SANSAD__.netMode && window.__SANSAD__.match?.phase === 'fight', { timeout: 20000 })
  await guest.waitForFunction(() => window.__SANSAD__.netMode && window.__SANSAD__.match?.phase === 'fight', { timeout: 20000 })

  const ids = await host.evaluate(() => window.__SANSAD__.match.fighters.map((f) => f.char.id))
  if (ids[0] !== 'modi' || ids[1] !== 'rahul') throw new Error('wrong roster in net match: ' + ids)

  // Both clients move toward each other, then the host throws a few punches.
  await host.keyboard.down('KeyD')
  await guest.keyboard.down('KeyA')
  await sleep(2200)
  await host.keyboard.up('KeyD')
  await guest.keyboard.up('KeyA')
  await sleep(400)
  for (let i = 0; i < 6; i++) {
    await host.keyboard.press('KeyJ')
    await sleep(220)
    const hpNow = await guest.evaluate(() => window.__SANSAD__.match.fighters[1].hp)
    if (hpNow < 100) break
  }
  await guest.waitForFunction(() => window.__SANSAD__.match.fighters[1].hp < 100, { timeout: 15000 })
  const guestHp = await guest.evaluate(() => window.__SANSAD__.match.fighters[1].hp)
  await host.screenshot({ path: 'tests/screenshots/10-online-host.png' })
  await guest.screenshot({ path: 'tests/screenshots/10-online-guest.png' })

  // Disconnect handling: closing the guest shows the away overlay on the host.
  await guest.close()
  await host.waitForSelector('#net-away:not(.hidden)', { timeout: 10000 })
  await host.click('#net-away-leave')
  await host.waitForSelector('#select:not(.hidden)', { timeout: 10000 })

  if (errors.length) throw new Error('browser errors:\n' + errors.join('\n'))
  console.log('online room passed:', { code, ids, guestHp })
} catch (err) {
  console.error('SERVER LOG:\n' + serverLog.slice(-2000))
  console.error('PAGE ERRORS:\n' + errors.join('\n'))
  throw err
} finally {
  await hostBrowser?.close()
  await guestBrowser?.close()
  if (server) {
    try { process.kill(-server.pid, 'SIGTERM') } catch { server.kill('SIGTERM') }
  }
}
