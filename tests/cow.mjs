import { chromium } from 'playwright'
import fs from 'node:fs'
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'

const PORT = 4177
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
  await page.keyboard.press('Enter')
  await page.waitForSelector('#hud:not(.hidden)')
  await page.waitForFunction(() => window.__SANSAD__.match?.phase === 'fight', { timeout: 20000 })

  await page.evaluate(() => { window.__SANSAD__.match.timer = 44.9 })
  await page.waitForFunction(() => window.__SANSAD__.cowActive === true, { timeout: 10000 })
  await page.waitForFunction(() => window.__SANSAD__.cow && window.__SANSAD__.cow.group.position.x > -4, { timeout: 20000 })
  await sleep(200)
  await page.screenshot({ path: 'tests/screenshots/09-cow.png' })
  const during = await page.evaluate(() => ({
    cowActive: window.__SANSAD__.cowActive,
    timer: window.__SANSAD__.match.timer,
    announce: document.querySelector('#announce').textContent,
  }))
  await page.waitForFunction(() => window.__SANSAD__.cowActive === false, { timeout: 20000 })
  const after = await page.evaluate(() => ({
    cowActive: window.__SANSAD__.cowActive,
    timer: window.__SANSAD__.match.timer,
    phase: window.__SANSAD__.match.phase,
  }))
  if (!during.cowActive) throw new Error('cow did not spawn')
  if (after.cowActive) throw new Error('cow did not leave')
  if (errors.length) throw new Error('browser errors:\n' + errors.join('\n'))
  console.log('cow event passed:', { during, after })
} finally {
  await browser?.close()
  try { process.kill(-server.pid, 'SIGTERM') } catch { server.kill('SIGTERM') }
}
