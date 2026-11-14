import * as THREE from 'three'
import { createPerson } from './avatar/person.js'
import { ChunkManager } from './world/chunkManager.js'

/**
 * Minimal real-3D walk slice: one road chunk + WASD person.
 * Existing / 360 panorama app is untouched.
 */

const canvas = document.getElementById('c')
const posReadout = document.getElementById('pos-readout')
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
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x9ec5d8)
scene.fog = new THREE.Fog(0x9ec5d8, 28, 70)

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 120)
camera.rotation.order = 'YXZ'

// Soft sky fill + key sun
const hemi = new THREE.HemisphereLight(0xd7e8f2, 0x6b8f5e, 0.85)
scene.add(hemi)
const sun = new THREE.DirectionalLight(0xfff1d6, 1.15)
sun.position.set(12, 22, 8)
sun.castShadow = true
sun.shadow.mapSize.set(1024, 1024)
sun.shadow.camera.near = 1
sun.shadow.camera.far = 60
sun.shadow.camera.left = -20
sun.shadow.camera.right = 20
sun.shadow.camera.top = 20
sun.shadow.camera.bottom = -20
scene.add(sun)

const chunks = new ChunkManager(scene)
chunks.loadStarterRoad()

const person = createPerson()
person.root.position.set(0, 0, 6)
person.setYaw(0) // face +Z down the road
scene.add(person.root)

const MOVE_SPEED = 5.2
const keys = new Set()
// yaw = π → camera sits on -Z side, looking down the road (+Z)
const look = {
  yaw: Math.PI,
  pitch: -0.22,
  targetYaw: Math.PI,
  targetPitch: -0.22,
}
const CAM_DIST = 6.5
const CAM_HEIGHT = 2.4
const pointer = { active: false, id: null, x: 0, y: 0, sens: 0.0045 }

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase()
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
    e.preventDefault()
    keys.add(k)
  }
})
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()))

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
  look.targetYaw -= dx * pointer.sens
  look.targetPitch -= dy * pointer.sens
  look.targetPitch = THREE.MathUtils.clamp(look.targetPitch, -1.1, 0.35)
})
function endPointer(e) {
  if (e.pointerId !== pointer.id) return
  pointer.active = false
  pointer.id = null
}
canvas.addEventListener('pointerup', endPointer)
canvas.addEventListener('pointercancel', endPointer)

function syncSize() {
  const w = window.innerWidth
  const h = window.innerHeight
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  renderer.setSize(w, h, false)
}
window.addEventListener('resize', syncSize)
syncSize()

const clock = new THREE.Clock()
const move = new THREE.Vector3()
const bounds = chunks.getBounds()

function clampToRoad(pos) {
  if (!bounds) return
  pos.x = THREE.MathUtils.clamp(pos.x, bounds.minX + 0.4, bounds.maxX - 0.4)
  pos.z = THREE.MathUtils.clamp(pos.z, bounds.minZ + 0.6, bounds.maxZ - 0.6)
}

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05)

  look.yaw += (look.targetYaw - look.yaw) * 0.22
  look.pitch += (look.targetPitch - look.pitch) * 0.22

  move.set(0, 0, 0)
  const forward = keys.has('w') || keys.has('arrowup')
  const back = keys.has('s') || keys.has('arrowdown')
  const left = keys.has('a') || keys.has('arrowleft')
  const right = keys.has('d') || keys.has('arrowright')

  if (forward) move.z -= 1
  if (back) move.z += 1
  if (left) move.x -= 1
  if (right) move.x += 1

  if (move.lengthSq() > 0) {
    move.normalize()
    // Camera-relative planar move
    const sin = Math.sin(look.yaw)
    const cos = Math.cos(look.yaw)
    const dx = move.x * cos + move.z * sin
    const dz = -move.x * sin + move.z * cos
    person.root.position.x += dx * MOVE_SPEED * dt
    person.root.position.z += dz * MOVE_SPEED * dt
    person.setYaw(Math.atan2(dx, dz))
  }

  clampToRoad(person.root.position)
  chunks.ensureAround(person.root.position.x, person.root.position.z)

  // Third-person follow
  const cx = person.root.position.x + Math.sin(look.yaw) * CAM_DIST
  const cz = person.root.position.z + Math.cos(look.yaw) * CAM_DIST
  const cy = person.root.position.y + CAM_HEIGHT + Math.sin(-look.pitch) * 1.2
  camera.position.set(cx, cy, cz)
  camera.lookAt(
    person.root.position.x,
    person.root.position.y + 1.2,
    person.root.position.z,
  )

  posReadout.textContent = `x ${person.root.position.x.toFixed(1)} · z ${person.root.position.z.toFixed(1)}`

  renderer.render(scene, camera)
  requestAnimationFrame(tick)
}

window.__minimal3d = {
  getPos() {
    return {
      x: person.root.position.x,
      y: person.root.position.y,
      z: person.root.position.z,
    }
  },
  setPos(x, z) {
    person.root.position.x = x
    person.root.position.z = z
    clampToRoad(person.root.position)
  },
}

tick()
