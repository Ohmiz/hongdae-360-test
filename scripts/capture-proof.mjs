#!/usr/bin/env node
/**
 * Capture fidelity proof: forward / left / right / back shots + short pan video frames.
 */
import puppeteer from 'puppeteer-core'
import { spawn } from 'node:child_process'
import { mkdir, copyFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const OUT = process.env.PROOF_DIR || '/cursor/stores/self/media/hongdae-360-test'
const URL = process.env.APP_URL || 'http://127.0.0.1:5173/'
const CHROME = process.env.CHROME_PATH || '/usr/local/bin/google-chrome'
const CONCEPT = '/cursor/stores/self/media/concept/implementable/web-hongdae-street.jpg'

await mkdir(OUT, { recursive: true })
await mkdir(path.join(OUT, 'frames'), { recursive: true })

const browser = await puppeteer.launch({
  executablePath: CHROME,
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
page.setDefaultNavigationTimeout(90000)
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90000 })
await page.waitForFunction(() => window.__hongdae360, { timeout: 30000 })
// wait for equirect texture to paint
await page.waitForFunction(() => {
  const c = document.getElementById('c')
  if (!c) return false
  const ctx = c.getContext('webgl2') || c.getContext('webgl')
  if (!ctx) return true
  const px = new Uint8Array(4)
  ctx.readPixels(c.width / 2, c.height / 2, 1, 1, ctx.RGBA, ctx.UNSIGNED_BYTE, px)
  // not near-black empty clear
  return px[0] + px[1] + px[2] > 30
}, { timeout: 20000 }).catch(() => {})
await new Promise((r) => setTimeout(r, 1200))

async function shot(name, lon = 0, lat = 0) {
  await page.evaluate(
    (lo, la) => window.__hongdae360.setLook(lo, la),
    lon,
    lat,
  )
  await new Promise((r) => setTimeout(r, 350))
  const dest = path.join(OUT, name)
  await page.screenshot({ path: dest, type: 'png' })
  console.log('wrote', dest)
}

await shot('01-forward-default.png', 0, 0)
await shot('02-look-left.png', 55, 0)
await shot('03-look-right.png', -55, 0)
await shot('04-look-back.png', 180, 0)
await shot('05-look-up.png', 0, 25)

// Side-by-side strip: concept | forward capture
await copyFile(CONCEPT, path.join(OUT, '00-concept-source.jpg'))

// Pan frames for ffmpeg video (~4s @ 30fps, yaw -90 → +90)
const frames = 90
for (let i = 0; i < frames; i++) {
  const t = i / (frames - 1)
  const lon = -90 + 180 * t
  await page.evaluate((lo) => window.__hongdae360.setLook(lo, 0), lon)
  await new Promise((r) => setTimeout(r, 40))
  const fp = path.join(OUT, 'frames', `frame-${String(i).padStart(3, '0')}.png`)
  await page.screenshot({ path: fp, type: 'png' })
}
await browser.close()

const videoPath = path.join(OUT, 'hongdae-360-pan.mp4')
await new Promise((resolve, reject) => {
  const ff = spawn(
    'ffmpeg',
    [
      '-y',
      '-framerate',
      '30',
      '-i',
      path.join(OUT, 'frames', 'frame-%03d.png'),
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-crf',
      '20',
      '-movflags',
      '+faststart',
      videoPath,
    ],
    { stdio: 'inherit' },
  )
  ff.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg ${code}`))))
})
console.log('wrote', videoPath)

// Compose side-by-side with Python/Pillow
const composeScript = `
from PIL import Image
import os
out = ${JSON.stringify(OUT)}
concept = Image.open(os.path.join(out, '00-concept-source.jpg')).convert('RGB')
forward = Image.open(os.path.join(out, '01-forward-default.png')).convert('RGB')
h = 720
concept = concept.resize((1280, h), Image.Resampling.LANCZOS)
forward = forward.resize((1280, h), Image.Resampling.LANCZOS)
# labels
from PIL import ImageDraw, ImageFont
canvas = Image.new('RGB', (1280*2 + 24, h + 48), (20, 18, 16))
canvas.paste(concept, (0, 48))
canvas.paste(forward, (1280 + 24, 48))
draw = ImageDraw.Draw(canvas)
draw.text((16, 12), '시안  (web-hongdae-street.jpg)', fill=(240, 230, 220))
draw.text((1280 + 40, 12), '360° forward (yaw 0°)', fill=(126, 200, 184))
canvas.save(os.path.join(out, 'side-by-side-concept-vs-360.png'), quality=92)
print('wrote side-by-side')
`
await writeFile('/tmp/compose_side_by_side.py', composeScript)
await new Promise((resolve, reject) => {
  const p = spawn('python3', ['/tmp/compose_side_by_side.py'], { stdio: 'inherit' })
  p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`compose ${code}`))))
})

console.log('done')
