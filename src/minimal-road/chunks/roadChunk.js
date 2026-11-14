import * as THREE from 'three'

/**
 * One road chunk — swap/load by id later for zone streaming.
 * World units ≈ meters. Chunk length along +Z.
 */
export const CHUNK_SIZE = 40

/**
 * @param {{ id?: string, origin?: THREE.Vector3, length?: number, width?: number }} opts
 * @returns {{ id: string, group: THREE.Group, bounds: { minX: number, maxX: number, minZ: number, maxZ: number }, dispose: () => void }}
 */
export function createRoadChunk(opts = {}) {
  const id = opts.id ?? 'road-0'
  const length = opts.length ?? CHUNK_SIZE
  const width = opts.width ?? 8
  const origin = opts.origin ?? new THREE.Vector3(0, 0, 0)

  const group = new THREE.Group()
  group.name = `chunk:${id}`
  group.position.copy(origin)

  // Asphalt deck
  const asphalt = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.12, length),
    new THREE.MeshStandardMaterial({
      color: 0x3a3f46,
      roughness: 0.92,
      metalness: 0.05,
    }),
  )
  asphalt.position.set(0, 0.06, length / 2)
  asphalt.receiveShadow = true
  asphalt.castShadow = false
  group.add(asphalt)

  // Center dashed line (few boxes — low poly)
  const dashMat = new THREE.MeshStandardMaterial({
    color: 0xe8d98a,
    roughness: 0.7,
    metalness: 0,
  })
  const dashLen = 2.2
  const gap = 1.6
  for (let z = 1.2; z < length - 1; z += dashLen + gap) {
    const dash = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, dashLen), dashMat)
    dash.position.set(0, 0.13, z + dashLen / 2)
    group.add(dash)
  }

  // Side curbs
  const curbMat = new THREE.MeshStandardMaterial({
    color: 0x8b9098,
    roughness: 0.85,
    metalness: 0.02,
  })
  for (const side of [-1, 1]) {
    const curb = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.28, length), curbMat)
    curb.position.set(side * (width / 2 + 0.1), 0.14, length / 2)
    curb.castShadow = true
    curb.receiveShadow = true
    group.add(curb)
  }

  // Shoulder strips (ground beside road — keeps silhouette readable)
  const shoulderMat = new THREE.MeshStandardMaterial({
    color: 0x6b8f5e,
    roughness: 1,
    metalness: 0,
  })
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Mesh(new THREE.BoxGeometry(4, 0.08, length), shoulderMat)
    shoulder.position.set(side * (width / 2 + 2.2), 0.04, length / 2)
    shoulder.receiveShadow = true
    group.add(shoulder)
  }

  const halfW = width / 2 + 0.2
  const bounds = {
    minX: origin.x - halfW,
    maxX: origin.x + halfW,
    minZ: origin.z,
    maxZ: origin.z + length,
  }

  return {
    id,
    group,
    bounds,
    dispose() {
      group.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose()
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose())
          else obj.material.dispose()
        }
      })
      group.removeFromParent()
    },
  }
}
