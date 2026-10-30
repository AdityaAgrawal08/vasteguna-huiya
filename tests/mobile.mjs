import { chromium } from 'playwright'
import fs from 'node:fs'
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'

const PORT = 4184
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
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    screen: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  })
  const page = await context.newPage()
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(m.text()) })
  await page.goto(URL, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#title:not(.hidden)', { timeout: 30000 })
  const skip = page.locator('#ios-swipe:not(.hidden) .swipe-skip')
  if (await skip.count()) await skip.click()
  const touchClass = await page.evaluate(() => document.documentElement.classList.contains('touch'))
  if (!touchClass) throw new Error('touch class missing')

  await page.tap('#title')
  await page.waitForSelector('#select:not(.hidden)')
  await page.screenshot({ path: 'tests/screenshots/12-mobile-select.png', timeout: 60000 })
  await page.tap('#fight-btn')
  await page.waitForSelector('#hud:not(.hidden)')
  await page.waitForFunction(() => window.__SANSAD__.match?.phase === 'fight', { timeout: 20000 })

  const touchDisplay = await page.evaluate(() => getComputedStyle(document.querySelector('#touch')).display)
  if (touchDisplay === 'none') throw new Error('touch controls are hidden')

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

  // Drag the virtual stick to the right, then release.
  const stick = await page.locator('#touch .stick').boundingBox()
  const x0 = await page.evaluate(() => window.__SANSAD__.match.fighters[0].x)
  await page.mouse.move(stick.x + stick.width / 2, stick.y + stick.height / 2)
  await page.mouse.down()
  await page.mouse.move(stick.x + stick.width / 2 + 38, stick.y + stick.height / 2, { steps: 5 })
  await sleep(500)
  await page.mouse.up()
  const x1 = await page.evaluate(() => window.__SANSAD__.match.fighters[0].x)
  if (Math.abs(x1 - x0) < 0.05) throw new Error(`stick did not move player: ${x0} -> ${x1}`)

  // Tap PUNCH while close.
  await page.evaluate(() => {
    const m = window.__SANSAD__.match
    m.fighters[0].x = -0.5; m.fighters[1].x = 0.5
    m.fighters[0].state = 'idle'; m.fighters[1].state = 'idle'
    m.fighters[0].facing = 1; m.fighters[1].facing = -1
  })
  await page.tap('#touch [data-touch="punch"]')
  await page.waitForFunction(() => window.__SANSAD__.match.fighters[1].hp < 100, { timeout: 10000 })
  const hp = await page.evaluate(() => window.__SANSAD__.match.fighters[1].hp)
  await page.screenshot({ path: 'tests/screenshots/12-mobile-fight.png', timeout: 60000 })

  if (errors.length) throw new Error('browser errors:\n' + errors.join('\n'))
  console.log('mobile/touch passed:', { touchClass, touchDisplay, x0, x1, hp })
} finally {
  await browser?.close()
  try { process.kill(-server.pid, 'SIGTERM') } catch { server.kill('SIGTERM') }
}
