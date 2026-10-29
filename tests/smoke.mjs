import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'
import fs from 'node:fs'

const PORT = 4173
const URL = `http://127.0.0.1:${PORT}/?quality=low`
const shots = 'tests/screenshots'
fs.mkdirSync(shots, { recursive: true })

const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
  cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'], detached: true,
})
let serverLog = ''
server.stdout.on('data', (d) => { serverLog += d })
server.stderr.on('data', (d) => { serverLog += d })

async function waitServer() {
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch(URL)
      if (r.ok) return
    } catch {}
    await sleep(250)
  }
  throw new Error('vite did not start\n' + serverLog)
}

const errors = []
let browser
try {
  await waitServer()
  browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-sandbox', '--no-sandbox'],
  })
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push('console: ' + m.text())
  })

  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.waitForSelector('#title:not(.hidden)', { timeout: 20000 })
  await page.screenshot({ path: `${shots}/01-title.png` })

  await page.keyboard.press('Enter')
  await page.waitForSelector('#select:not(.hidden)')
  await sleep(300)
  await page.screenshot({ path: `${shots}/02-select.png` })

  // Character select keyboard + stage cycling
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('KeyT')
  await sleep(200)
  const sel = await page.evaluate(() => ({ ...window.__SANSAD__.select }))
  if (sel.stage !== 'jantar') throw new Error('stage cycle failed: ' + JSON.stringify(sel))
  await page.keyboard.press('ArrowLeft')

  await page.keyboard.press('Enter')
  await page.waitForSelector('#hud:not(.hidden)')
  await page.waitForFunction(() => window.__SANSAD__.match?.phase === 'fight', { timeout: 20000 })
  const phase = await page.evaluate(() => window.__SANSAD__.match.phase)
  await page.screenshot({ path: `${shots}/03-fight.png` })

  // Land a jab in the real UI (freeze the CPU so the test is deterministic)
  await page.evaluate(() => {
    const app = window.__SANSAD__
    app.cpu.update = () => ({ moveX: 0, up: false, down: false, punch: false, kick: false, grab: false, super: false })
    const m = app.match
    for (const f of m.fighters) {
      f.state = 'idle'; f.attack = null; f.stun = 0; f.buffer = null; f.vx = 0
      f.x = f.side === 0 ? -0.5 : 0.5
      f.facing = f.side === 0 ? 1 : -1
      f.hp = 100
    }
  })
  await page.keyboard.press('KeyJ')
  await page.waitForFunction(() => window.__SANSAD__.match.fighters[1].hp < 100, { timeout: 8000 })
  const hp = await page.evaluate(() => window.__SANSAD__.match.fighters[1].hp)
  await page.screenshot({ path: `${shots}/04-hit.png` })

  // Pause screen
  await page.keyboard.press('Escape')
  await page.waitForSelector('#pause:not(.hidden)')
  await page.screenshot({ path: `${shots}/05-pause.png` })
  await page.click('#resume-btn')
  await page.waitForFunction(() => document.querySelector('#pause').classList.contains('hidden'))

  // Force a KO to reach the newspaper result screen (combat itself is covered by
  // the deterministic engine tests; here we exercise the round/result flow).
  await page.evaluate(() => {
    const m = window.__SANSAD__.match
    m.wins[0] = 1
    m.fighters[1].hp = 0
    m.fighters[1].state = 'ko'
    m.endRound(0, false)
  })
  await page.waitForSelector('#result:not(.hidden)', { timeout: 30000 })
  await sleep(800)
  await page.screenshot({ path: `${shots}/06-result.png` })
  const result = await page.evaluate(() => ({
    title: document.querySelector('#result-title').textContent,
    headline: document.querySelector('#paper-headline').textContent,
  }))
  if (!result.headline) throw new Error('empty newspaper headline')

  // Rematch goes back into a live fight
  await page.click('#rematch-btn')
  await page.waitForSelector('#hud:not(.hidden)')
  await page.waitForFunction(() => window.__SANSAD__.match?.phase === 'fight', { timeout: 20000 })
  const phase2 = await page.evaluate(() => window.__SANSAD__.match.phase)

  // Super move: meter → cinematic → 30% damage
  await page.evaluate(() => {
    const app = window.__SANSAD__
    app.cpu.update = () => ({ moveX: 0, up: false, down: false, punch: false, kick: false, grab: false, super: false })
    const m = app.match
    for (const f of m.fighters) {
      f.state = 'idle'; f.attack = null; f.stun = 0; f.buffer = null; f.vx = 0
      f.x = f.side === 0 ? -1.2 : 1.2
      f.facing = f.side === 0 ? 1 : -1
    }
    m.fighters[0].meter = 100
  })
  await page.keyboard.press('KeyL')
  await page.waitForFunction(() => window.__SANSAD__.match?.phase === 'super', { timeout: 10000 })
  await sleep(900)
  const banner = await page.evaluate(() => document.querySelector('#super-banner').textContent)
  await page.screenshot({ path: `${shots}/07-super.png` })
  await page.waitForFunction(() => window.__SANSAD__.match.fighters[1].hp <= 70, { timeout: 25000 })
  await page.waitForFunction(() => window.__SANSAD__.match.phase === 'fight', { timeout: 25000 })
  const superHp = await page.evaluate(() => window.__SANSAD__.match.fighters[1].hp)

  if (errors.length) throw new Error('browser errors:\n' + errors.join('\n'))
  console.log('e2e passed:', { phase, hp, result, phase2, banner, superHp })
  console.log('screenshots in', shots)
} finally {
  await browser?.close()
  try { process.kill(-server.pid, 'SIGTERM') } catch { server.kill('SIGTERM') }
}
