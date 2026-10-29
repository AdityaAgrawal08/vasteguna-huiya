import { chromium } from 'playwright'
import fs from 'node:fs'
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'

const PORT = 4176
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
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  await page.goto(URL, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#title:not(.hidden)', { timeout: 20000 })
  await page.keyboard.press('Enter')
  await page.waitForSelector('#select:not(.hidden)')

  for (const stage of ['sansad', 'jantar', 'road']) {
    await page.click(`[data-stage="${stage}"]`)
    await sleep(300)
    await page.screenshot({ path: `tests/screenshots/stage-${stage}-select.png` })
    await page.keyboard.press('Enter')
    await page.waitForSelector('#hud:not(.hidden)')
    await page.waitForFunction(() => window.__SANSAD__.match?.phase === 'fight', { timeout: 25000 })
    await sleep(500)
    const info = await page.evaluate(() => ({
      stage: window.__SANSAD__.match.stage,
      p1: window.__SANSAD__.match.fighters[0].char.id,
      p2: window.__SANSAD__.match.fighters[1].char.id,
    }))
    if (info.stage !== stage) throw new Error(`stage mismatch: ${info.stage} != ${stage}`)
    await page.screenshot({ path: `tests/screenshots/stage-${stage}-fight.png` })
    await page.keyboard.press('Escape')
    await page.waitForSelector('#pause:not(.hidden)')
    await page.click('#quit-btn')
    await page.waitForSelector('#select:not(.hidden)')
    console.log('stage ok', info)
  }

  if (errors.length) throw new Error('browser errors:\n' + errors.join('\n'))
  console.log('all three stages rendered')
} finally {
  await browser?.close()
  try { process.kill(-server.pid, 'SIGTERM') } catch { server.kill('SIGTERM') }
}
