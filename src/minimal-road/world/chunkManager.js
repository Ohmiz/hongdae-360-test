import * as THREE from 'three'
import { createRoadChunk, CHUNK_SIZE } from '../chunks/roadChunk.js'

/**
 * Stub chunk/zone manager — today loads one road chunk;
 * later: stream by player cell (cx, cz).
 */
export class ChunkManager {
  /**
   * @param {THREE.Scene} scene
   */
  constructor(scene) {
    this.scene = scene
    /** @type {Map<string, ReturnType<typeof createRoadChunk>>} */
    this.loaded = new Map()
    this.activeBounds = null
  }

  /**
   * Load a single starter road along +Z from origin.
   * Future: accept a zone id + neighbor keys.
   */
  loadStarterRoad() {
    const chunk = createRoadChunk({
      id: 'road-0',
      origin: new THREE.Vector3(0, 0, 0),
      length: CHUNK_SIZE,
      width: 8,
    })
    this.scene.add(chunk.group)
    this.loaded.set(chunk.id, chunk)
    this.activeBounds = chunk.bounds
    return chunk
  }

  /**
   * Placeholder for streaming: resolve which chunk keys surround a world position.
   * @param {number} x
   * @param {number} z
   * @returns {string[]}
   */
  // eslint-disable-next-line no-unused-vars
  keysAround(x, z) {
    const cx = Math.floor(x / CHUNK_SIZE)
    const cz = Math.floor(z / CHUNK_SIZE)
    // 3×1 strip along road for now — expand when more zones exist
    return [`road:${cx},${cz}`]
  }

  /**
   * No-op ensure for now; keeps API stable for a future streamer.
   * @param {number} x
   * @param {number} z
   */
  ensureAround(x, z) {
    void this.keysAround(x, z)
  }

  getBounds() {
    return this.activeBounds
  }

  dispose() {
    for (const chunk of this.loaded.values()) chunk.dispose()
    this.loaded.clear()
    this.activeBounds = null
  }
}
