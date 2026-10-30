import { chromium } from 'playwright'
import fs from 'node:fs'
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'

const PORT = 4188
const URL = `http://127.0.0.1:${PORT}/?quality=low`
const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
  cwd: process.cwd(), stdio: 'ignore', detached: true,
})
for (let i = 0; i < 80; i++) {
  try { if ((await fetch(URL)).ok) break } catch {}
  await sleep(200)
}

const SHOTS = [
  { id: 'modi', beats: [0.9, 1.8, 2.4, 3.0, 3.6] },
  { id: 'rahul', beats: [0.5, 1.4, 2.4, 3.2, 4.1] },
  { id: 'didi', beats: [0.9, 1.8, 2.6, 3.6, 4.4] },
  { id: 'trump', beats: [0.6, 1.4, 2.4, 3.2, 3.9] },
  { id: 'yogi', beats: [0.6, 1.4, 2.4, 3.5, 4.3] },
  { id: 'nitin', beats: [0.7, 1.5, 2.4, 3.6, 4.4] },
]

const errors = []
let browser
try {
  browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
  })
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } })
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    if (m.text().includes('Failed to load resource')) return
    errors.push('console: ' + m.text())
  })

  for (const { id, beats } of SHOTS) {
    await page.goto(URL, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('#title:not(.hidden)', { timeout: 40000 })
    await page.keyboard.press('Enter')
    await page.waitForSelector('#select:not(.hidden)')
    // pick the character for player 1
    await page.click(`[data-tile="${id}"]`)
    await page.waitForFunction((c) => window.__SANSAD__.select.p1 === c, id)
    await page.keyboard.press('Enter')
    await page.waitForSelector('#hud:not(.hidden)')
    await page.waitForFunction(() => window.__SANSAD__.match?.phase === 'fight', { timeout: 30000 })

    await page.evaluate(() => {
      const app = window.__SANSAD__
      app.cpu.update = () => ({ moveX: 0, up: false, down: false, punch: false, kick: false, grab: false, super: false })
      const m = app.match
      for (const f of m.fighters) {
        f.state = 'idle'; f.attack = null; f.stun = 0; f.buffer = null; f.vx = 0
        f.x = f.side === 0 ? -2.4 : 2.4
        f.facing = f.side === 0 ? 1 : -1
        f.hp = 100
      }
      m.fighters[0].meter = 100
    })

    await page.keyboard.press('KeyL')
    await page.waitForFunction(() => window.__SANSAD__.match?.phase === 'super', { timeout: 15000 })

    let prev = 0
    for (const beat of beats) {
      await page.waitForFunction((target) => window.__SANSAD__.superSeq && window.__SANSAD__.superSeq.t >= target, beat, { timeout: 25000 })
      await page.screenshot({ path: `tests/screenshots/super-${id}-${String(beat).replace('.', '_')}.png`, timeout: 60000 })
      prev = beat
    }

    // The critical regression: after the cinematic the fight must resume.
    await page.waitForFunction(() => window.__SANSAD__.match?.phase !== 'super', { timeout: 25000 })
    // Let the impact flash finish so we can capture a clean aftermath frame:
    // opponent back on their feet, visibly down on health.
    await page.waitForFunction(() => getComputedStyle(document.getElementById('flash')).opacity === '0', null, { timeout: 8000 }).catch(() => {})
    await page.waitForFunction(() => {
      const s = window.__SANSAD__.match.fighters[1].state
      return s === 'idle' || s === 'walk' || s === 'crouch'
    }, null, { timeout: 8000 }).catch(() => {})
    await page.screenshot({ path: `tests/screenshots/super-${id}-aftermath.png`, timeout: 60000 })
    const after = await page.evaluate(() => {
      const m = window.__SANSAD__.match
      return {
        phase: m.phase,
        casterState: m.fighters[0].state,
        targetState: m.fighters[1].state,
        targetHp: m.fighters[1].hp,
        casterActionable: m.fighters[0].actionable,
      }
    })
    if (after.casterState === 'super') throw new Error(`${id}: caster stuck in super state`)
    if (!after.casterActionable) throw new Error(`${id}: caster not actionable (${after.casterState})`)
    if (after.targetState === 'frozen') throw new Error(`${id}: target stuck frozen`)
    if (after.targetHp >= 100) throw new Error(`${id}: no damage dealt`)

    // Prove the caster can walk again.
    const x0 = await page.evaluate(() => window.__SANSAD__.match.fighters[0].x)
    await page.keyboard.down('KeyD')
    await sleep(500)
    await page.keyboard.up('KeyD')
    const x1 = await page.evaluate(() => window.__SANSAD__.match.fighters[0].x)
    if (Math.abs(x1 - x0) < 0.05) throw new Error(`${id}: caster cannot move after super (${x0} -> ${x1})`)

    console.log(`cinematic ok: ${id}`, { after, moved: +(x1 - x0).toFixed(2) })
  }

  if (errors.length) throw new Error('browser errors:\n' + errors.join('\n'))
  console.log('all six cinematics verified')
} finally {
  await browser?.close()
  try { process.kill(-server.pid, 'SIGTERM') } catch { server.kill('SIGTERM') }
}
