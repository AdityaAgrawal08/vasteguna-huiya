import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'

const PORT = 4174
const URL = `http://127.0.0.1:${PORT}/?quality=low`
const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
  cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'], detached: true,
})

for (let i = 0; i < 80; i++) {
  try { if ((await fetch(URL)).ok) break } catch {}
  await sleep(200)
}

const errors = []
let browser
try {
  browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/usr/bin/chromium',
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
  })
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })

  await page.goto(URL, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#title:not(.hidden)', { timeout: 20000 })
  await page.keyboard.press('Enter')
  await page.waitForSelector('#select:not(.hidden)')
  await page.click('#online-btn')
  await page.waitForSelector('#online:not(.hidden)')
  await page.click('#on-local')
  await page.waitForSelector('#select:not(.hidden)')
  const online = await page.evaluate(() => ({
    active: window.__SANSAD__.online.active,
    local: window.__SANSAD__.local2p,
    status: document.querySelector('#online-status').textContent,
  }))
  if (!online.active || !online.local) throw new Error('local 2P mode did not activate')

  await page.keyboard.press('Enter')
  await page.waitForSelector('#hud:not(.hidden)')
  await page.waitForFunction(() => window.__SANSAD__.match?.phase === 'fight', { timeout: 20000 })

  const x0 = await page.evaluate(() => window.__SANSAD__.match.fighters[1].x)
  await page.keyboard.down('ArrowLeft')
  await sleep(500)
  await page.keyboard.up('ArrowLeft')
  const x1 = await page.evaluate(() => window.__SANSAD__.match.fighters[1].x)
  if (Math.abs(x1 - x0) < 0.1) throw new Error(`P2 did not move: ${x0} -> ${x1}`)

  await page.evaluate(() => {
    const m = window.__SANSAD__.match
    for (const f of m.fighters) {
      f.state = 'idle'; f.attack = null; f.stun = 0; f.buffer = null; f.vx = 0
      f.x = f.side === 0 ? -0.5 : 0.5
      f.facing = f.side === 0 ? 1 : -1
      f.hp = 100
    }
  })
  await page.keyboard.press('Numpad1')
  await page.waitForFunction(() => window.__SANSAD__.match.fighters[0].hp < 100, { timeout: 8000 })
  const p1hp = await page.evaluate(() => window.__SANSAD__.match.fighters[0].hp)
  await page.screenshot({ path: 'tests/screenshots/08-local2p.png' })

  if (errors.length) throw new Error('browser errors:\n' + errors.join('\n'))
  console.log('local 2P passed:', { online, x0, x1, p1hp })
} finally {
  await browser?.close()
  try { process.kill(-server.pid, 'SIGTERM') } catch { server.kill('SIGTERM') }
}
