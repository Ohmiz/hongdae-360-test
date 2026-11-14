#!/usr/bin/env node
import puppeteer from 'puppeteer-core'
import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'

const require = createRequire(import.meta.url)
// no sharp — compare via canvas in page

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
await page.goto('http://127.0.0.1:5173/?t=' + Date.now(), {
  waitUntil: 'domcontentloaded',
  timeout: 90000,
})
await page.waitForFunction(() => window.__hongdae360, { timeout: 30000 })
await new Promise((r) => setTimeout(r, 1500))

// Load concept into page for pixel compare
await page.evaluate(async () => {
  const img = new Image()
  img.crossOrigin = 'anonymous'
  await new Promise((res, rej) => {
    img.onload = res
    img.onerror = rej
    img.src = '/concept-hongdae.jpg'
  })
  const c = document.createElement('canvas')
  c.width = 1280
  c.height = 720
  c.getContext('2d').drawImage(img, 0, 0, 1280, 720)
  window.__conceptData = c.getContext('2d').getImageData(160, 120, 960, 480).data
})

const results = []
for (const yaw of [-180, -135, -90, -45, 0, 45, 90, 135, 180]) {
  for (const pitch of [0]) {
    await page.evaluate((y, p) => window.__hongdae360.setLook(y, p), yaw, pitch)
    await new Promise((r) => setTimeout(r, 200))
    const mae = await page.evaluate(() => {
      const canvas = document.getElementById('c')
      // read from webgl is hard; screenshot via toDataURL of whole page canvas after... 
      // Instead sample via drawing page canvas — WebGL canvas may be tainted differently.
      // Use a 2d copy via drawImage of webgl canvas
      const tmp = document.createElement('canvas')
      tmp.width = 1280
      tmp.height = 720
      const ctx = tmp.getContext('2d')
      ctx.drawImage(canvas, 0, 0)
      const data = ctx.getImageData(160, 120, 960, 480).data
      const ref = window.__conceptData
      let sum = 0
      let n = 0
      for (let i = 0; i < data.length; i += 16) {
        // subsample every 4th pixel
        sum += Math.abs(data[i] - ref[i])
        sum += Math.abs(data[i + 1] - ref[i + 1])
        sum += Math.abs(data[i + 2] - ref[i + 2])
        n += 3
      }
      return sum / n
    })
    results.push({ yaw, pitch, mae })
    console.log(`yaw ${yaw} pitch ${pitch} mae ${mae.toFixed(2)}`)
  }
}

results.sort((a, b) => a.mae - b.mae)
console.log('best', results[0])
writeFileSync('/tmp/yaw-sweep.json', JSON.stringify(results, null, 2))

// capture best
const best = results[0]
await page.evaluate((y, p) => window.__hongdae360.setLook(y, p), best.yaw, best.pitch)
await new Promise((r) => setTimeout(r, 300))
await page.screenshot({ path: '/tmp/hongdae-shots/best-yaw.png', type: 'png' })
await browser.close()
