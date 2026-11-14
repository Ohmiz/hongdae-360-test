import * as THREE from 'three'

/**
 * Low-poly person (capsule-ish primitives). Root Y = feet on ground.
 */
export function createPerson() {
  const root = new THREE.Group()
  root.name = 'person'

  const skin = new THREE.MeshStandardMaterial({
    color: 0xc48a6a,
    roughness: 0.75,
    metalness: 0.05,
  })
  const shirt = new THREE.MeshStandardMaterial({
    color: 0x2f6f5e,
    roughness: 0.7,
    metalness: 0.08,
  })
  const pants = new THREE.MeshStandardMaterial({
    color: 0x2c3540,
    roughness: 0.85,
    metalness: 0.05,
  })
  const shoes = new THREE.MeshStandardMaterial({
    color: 0x1a1f24,
    roughness: 0.9,
    metalness: 0.1,
  })

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.32), shirt)
  torso.position.set(0, 1.15, 0)
  torso.castShadow = true
  root.add(torso)

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.4, 0.36), skin)
  head.position.set(0, 1.72, 0)
  head.castShadow = true
  root.add(head)

  const hip = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.28, 0.28), pants)
  hip.position.set(0, 0.72, 0)
  hip.castShadow = true
  root.add(hip)

  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.55, 0.2), pants)
    leg.position.set(side * 0.14, 0.35, 0)
    leg.castShadow = true
    root.add(leg)

    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.32), shoes)
    shoe.position.set(side * 0.14, 0.05, 0.04)
    shoe.castShadow = true
    root.add(shoe)

    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.55, 0.14), shirt)
    arm.position.set(side * 0.38, 1.1, 0)
    arm.castShadow = true
    root.add(arm)
  }

  // Facing +Z when yaw = 0
  root.rotation.order = 'YXZ'

  return {
    root,
    height: 1.9,
    /** @param {number} yawRad facing angle around Y */
    setYaw(yawRad) {
      root.rotation.y = yawRad
    },
    dispose() {
      root.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose()
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose())
          else obj.material.dispose()
        }
      })
      root.removeFromParent()
    },
  }
}
