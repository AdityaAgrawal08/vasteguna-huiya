import { chromium } from 'playwright'
import fs from 'node:fs'
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'

const PORT = 4183
const URL = `http://127.0.0.1:${PORT}/?quality=low`
const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
  cwd: process.cwd(), stdio: 'ignore', detached: true,
})
for (let i = 0; i < 80; i++) {
  try { if ((await fetch(URL)).ok) break } catch {}
  await sleep(200)
}

const errors = []
let browser
try {
  browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
  })
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(m.text()) })
  await page.goto(URL, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#title:not(.hidden)', { timeout: 20000 })
  await page.keyboard.press('Enter')
  await page.waitForSelector('#select:not(.hidden)')
  await page.keyboard.press('Enter')
  await page.waitForSelector('#hud:not(.hidden)')
  await page.waitForFunction(() => window.__SANSAD__.match?.phase === 'fight', { timeout: 20000 })

  const before = await page.evaluate(() => {
    const app = window.__SANSAD__
    app.cpu.update = () => ({ moveX: 0, up: false, down: false, punch: false, kick: false, grab: false, super: false })
    const m = app.match
    const cup = app.chaiCup
    for (const f of m.fighters) { f.state = 'idle'; f.attack = null; f.stun = 0; f.buffer = null; f.vx = 0 }
    m.fighters[0].x = cup.x - 0.6
    m.fighters[1].x = cup.x
    m.fighters[0].facing = 1
    m.fighters[1].facing = -1
    m.fighters[1].hp = 100
    return { cup: [cup.x, cup.z], broken: cup.broken }
  })
  if (before.broken) throw new Error('cup started broken')

  await page.keyboard.down('KeyS')
  await sleep(80)
  await page.keyboard.press('KeyK')
  await sleep(120)
  await page.keyboard.up('KeyS')
  await page.waitForFunction(() => window.__SANSAD__.chaiCup?.broken === true, { timeout: 10000 })
  await page.screenshot({ path: 'tests/screenshots/11-chai-cup.png' })
  const after = await page.evaluate(() => ({
    broken: window.__SANSAD__.chaiCup.broken,
    announce: document.querySelector('#announce').textContent,
    ticker: document.querySelector('#newsdesk .ticker-track').textContent,
  }))
  if (errors.length) throw new Error('browser errors:\n' + errors.join('\n'))
  console.log('chai cup passed:', { before, after })
} finally {
  await browser?.close()
  try { process.kill(-server.pid, 'SIGTERM') } catch { server.kill('SIGTERM') }
}
