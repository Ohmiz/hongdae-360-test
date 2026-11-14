#!/usr/bin/env node
import puppeteer from 'puppeteer-core'
import { mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

await mkdir('/tmp/hongdae-sweep', { recursive: true })
const browser = await puppeteer.launch({
  executablePath: '/usr/local/bin/google-chrome',
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-gpu',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--window-size=1280,720',
  ],
  defaultViewport: { width: 1280, height: 720, deviceScaleFactor: 1 },
})
const page = await browser.newPage()
await page.goto('http://127.0.0.1:5173/?bust=' + Date.now(), {
  waitUntil: 'domcontentloaded',
  timeout: 90000,
})
await page.waitForFunction(() => window.__hongdae360, { timeout: 30000 })
await new Promise((r) => setTimeout(r, 1500))

for (const yaw of [-180, -135, -90, -45, 0, 45, 90, 135, 180]) {
  await page.evaluate((y) => window.__hongdae360.setLook(y, 0), yaw)
  await new Promise((r) => setTimeout(r, 400))
  const name = `/tmp/hongdae-sweep/yaw${yaw >= 0 ? '+' : ''}${yaw}.png`
  await page.screenshot({ path: name, type: 'png' })
  console.log('wrote', name)
}
await browser.close()
