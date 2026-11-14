import * as THREE from 'three'

/**
 * Hongdae 360° fidelity viewer
 * - Equirectangular as scene.background (Three.js EquirectangularReflectionMapping)
 * - Source 시안 stamped into forward ~80° HFOV (see scripts/make_equirect.py)
 * - Look: pointer drag, touch, arrow keys
 */

const canvas = document.getElementById('c')
const yawReadout = document.getElementById('yaw-readout')
canvas.focus()
canvas.addEventListener('pointerdown', () => canvas.focus())

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
})
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
renderer.setSize(window.innerWidth, window.innerHeight, false)
renderer.outputColorSpace = THREE.SRGBColorSpace

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100)
camera.rotation.order = 'YXZ'
camera.position.set(0, 0, 0)

const loader = new THREE.TextureLoader()
const texture = await loader.loadAsync('/hongdae-equirect.jpg')
texture.colorSpace = THREE.SRGBColorSpace
texture.mapping = THREE.EquirectangularReflectionMapping
texture.minFilter = THREE.LinearMipmapLinearFilter
texture.magFilter = THREE.LinearFilter
scene.background = texture

// lon/lat in radians. lon=0 → equirect center (시안 forward stamp).
// Three.js equirectUv uses atan(z,x): default look (-Z) samples u=0.25, while
// our stamp sits at u=0.5. Empirically camera.y = 3π/2 faces the stamp.
const EQ_YAW_OFFSET = (Math.PI * 3) / 2

const look = {
  lon: 0,
  lat: 0,
  targetLon: 0,
  targetLat: 0,
}

const MAX_LAT = THREE.MathUtils.degToRad(72)
const KEY_SPEED = THREE.MathUtils.degToRad(1.35)

function applyLook() {
  look.lat = THREE.MathUtils.clamp(look.lat, -MAX_LAT, MAX_LAT)
  look.targetLat = THREE.MathUtils.clamp(look.targetLat, -MAX_LAT, MAX_LAT)
  camera.rotation.y = look.lon + EQ_YAW_OFFSET
  camera.rotation.x = look.lat

  const yawDeg = ((THREE.MathUtils.radToDeg(look.lon) % 360) + 360) % 360
  const signed = yawDeg > 180 ? yawDeg - 360 : yawDeg
  yawReadout.textContent = `yaw ${signed.toFixed(0)}° · pitch ${THREE.MathUtils.radToDeg(look.lat).toFixed(0)}°`
}

const pointer = {
  active: false,
  id: null,
  x: 0,
  y: 0,
  sens: 0.005,
}

canvas.addEventListener('pointerdown', (e) => {
  pointer.active = true
  pointer.id = e.pointerId
  pointer.x = e.clientX
  pointer.y = e.clientY
  canvas.setPointerCapture(e.pointerId)
})

canvas.addEventListener('pointermove', (e) => {
  if (!pointer.active || e.pointerId !== pointer.id) return
  const dx = e.clientX - pointer.x
  const dy = e.clientY - pointer.y
  pointer.x = e.clientX
  pointer.y = e.clientY
  // drag right → look right (decrease yaw in Three Y-up CCW convention? drag right = see left content)
  look.targetLon -= dx * pointer.sens
  look.targetLat -= dy * pointer.sens
})

function endPointer(e) {
  if (e.pointerId !== pointer.id) return
  pointer.active = false
  pointer.id = null
}

canvas.addEventListener('pointerup', endPointer)
canvas.addEventListener('pointercancel', endPointer)
canvas.addEventListener('pointerleave', endPointer)

const keys = new Set()
window.addEventListener('keydown', (e) => {
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
    e.preventDefault()
    keys.add(e.key)
  }
})
window.addEventListener('keyup', (e) => keys.delete(e.key))

function syncFov() {
  const w = window.innerWidth
  const h = window.innerHeight
  camera.aspect = w / h
  const hFov = THREE.MathUtils.degToRad(80)
  camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(hFov / 2) / camera.aspect))
  camera.updateProjectionMatrix()
  renderer.setSize(w, h, false)
}

window.addEventListener('resize', syncFov)
syncFov()

function tick() {
  if (keys.has('ArrowLeft')) look.targetLon += KEY_SPEED
  if (keys.has('ArrowRight')) look.targetLon -= KEY_SPEED
  if (keys.has('ArrowUp')) look.targetLat += KEY_SPEED
  if (keys.has('ArrowDown')) look.targetLat -= KEY_SPEED

  look.lon += (look.targetLon - look.lon) * 0.18
  look.lat += (look.targetLat - look.lat) * 0.18

  applyLook()
  renderer.render(scene, camera)
  requestAnimationFrame(tick)
}

applyLook()
tick()

window.__hongdae360 = {
  setLook(lonDeg, latDeg = 0) {
    const lon = THREE.MathUtils.degToRad(lonDeg)
    const lat = THREE.MathUtils.degToRad(latDeg)
    look.lon = lon
    look.lat = lat
    look.targetLon = lon
    look.targetLat = lat
    applyLook()
  },
  getLook() {
    return {
      lon: THREE.MathUtils.radToDeg(look.lon),
      lat: THREE.MathUtils.radToDeg(look.lat),
    }
  },
  panTo(lonDeg, latDeg = 0, ms = 1200) {
    return new Promise((resolve) => {
      const startLon = look.lon
      const startLat = look.lat
      const endLon = THREE.MathUtils.degToRad(lonDeg)
      const endLat = THREE.MathUtils.degToRad(latDeg)
      const t0 = performance.now()
      const step = (t) => {
        const u = Math.min(1, (t - t0) / ms)
        const e = 1 - (1 - u) ** 3
        look.lon = startLon + (endLon - startLon) * e
        look.lat = startLat + (endLat - startLat) * e
        look.targetLon = look.lon
        look.targetLat = look.lat
        if (u < 1) requestAnimationFrame(step)
        else resolve()
      }
      requestAnimationFrame(step)
    })
  },
}
