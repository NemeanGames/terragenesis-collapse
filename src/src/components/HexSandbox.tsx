import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import {
  useGameStore,
  HexPoiState,
  HexBaseState,
} from '../state/useGameStore'

const HEX_SIZE = 4
const GRID_RADIUS = 22
const TILE_H = 0.15
const WATER_COLOR = 0x23405a
const LAND_COLOR = 0x647a8a
const HOVER_COLOR = 0x66ccff
const BASE_COLOR = 0x33aa55
const ROAD_COLORS = {
  highway: 0xe07a15,
  street: 0xb0b0b0,
  side: 0x888888,
} as const

const POI_TYPES = [
  { id: 'grocery', emoji: '🛒' },
  { id: 'clinic', emoji: '🏥' },
  { id: 'fuel', emoji: '⛽' },
  { id: 'warehouse', emoji: '🏭' },
  { id: 'ruins', emoji: '🏚️' },
]

const POI_COUNT = 12
const K_NEAREST = 3

type Axial = { q: number; r: number }

type Cell = {
  q: number
  r: number
  pos: THREE.Vector3
  tile: THREE.Mesh
  elev: number
  water: boolean
  kind?: 'base'
}

type POI = {
  id: string
  cell: Cell
  type: string
  sprite: THREE.Sprite
  cooldown: number
}

const axialDirs: Axial[] = [
  { q: +1, r: 0 },
  { q: +1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: +1 },
  { q: 0, r: +1 },
]

function axialToWorld(q: number, r: number, size = HEX_SIZE) {
  const x = size * Math.sqrt(3) * (q + r / 2)
  const z = size * 1.5 * r
  return new THREE.Vector3(x, 0, z)
}

function hexDist(a: Axial, b: Axial) {
  const x1 = a.q
  const z1 = a.r
  const y1 = -x1 - z1
  const x2 = b.q
  const z2 = b.r
  const y2 = -x2 - z2
  return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2), Math.abs(z1 - z2))
}

function elevAt(q: number, r: number) {
  const x = q * 0.17
  const y = r * 0.19
  const v =
    0.5 +
    0.25 * Math.sin(x * 1.7 + Math.cos(y * 1.3)) +
    0.15 * Math.sin(x * 0.6) * Math.cos(y * 0.9) +
    0.1 * Math.sin((x + y) * 0.33)
  return THREE.MathUtils.clamp(v, 0, 1)
}

function makeEmojiSprite(emoji = '🏕️', pixel = 128, scale = HEX_SIZE * 1.2) {
  const cvs = document.createElement('canvas')
  cvs.width = cvs.height = pixel
  const ctx = cvs.getContext('2d')!
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `${Math.floor(pixel * 0.8)}px sans-serif`
  ctx.fillText(emoji, pixel / 2, pixel / 2)
  const tex = new THREE.CanvasTexture(cvs)
  tex.anisotropy = 4
  const mat = new THREE.SpriteMaterial({
    map: tex,
    depthTest: true,
    depthWrite: false,
    transparent: true,
  })
  const sprite = new THREE.Sprite(mat)
  sprite.scale.set(scale, scale, 1)
  sprite.position.y = TILE_H + 0.02
  return sprite
}

function disposeSprite(sprite: THREE.Sprite | null) {
  if (!sprite) return
  const material = sprite.material as THREE.SpriteMaterial
  material.map?.dispose()
  material.dispose()
}

function findPath(start: Cell, goal: Cell, index: Map<string, Cell>) {
  const key = (q: number, r: number) => `${q},${r}`
  const open = new Set<string>()
  open.add(key(start.q, start.r))
  const came = new Map<string, string>()
  const g = new Map<string, number>()
  g.set(key(start.q, start.r), 0)
  const f = new Map<string, number>()
  f.set(key(start.q, start.r), hexDist(start, goal))

  const lowestF = () => {
    let best: string | null = null
    let bestV = Infinity
    for (const k of open) {
      const v = f.get(k) ?? Infinity
      if (v < bestV) {
        bestV = v
        best = k
      }
    }
    return best
  }

  while (open.size) {
    const curK = lowestF()
    if (!curK) break
    const [cq, cr] = curK.split(',').map(Number)
    if (cq === goal.q && cr === goal.r) {
      const out: Cell[] = []
      let ck: string | undefined = curK
      while (ck) {
        const c = index.get(ck)
        if (!c) break
        out.push(c)
        ck = came.get(ck)
      }
      return out.reverse()
    }
    open.delete(curK)
    const cur = index.get(curK)
    if (!cur) continue

    for (const d of axialDirs) {
      const nq = cq + d.q
      const nr = cr + d.r
      const nk = key(nq, nr)
      const n = index.get(nk)
      if (!n || n.water) continue
      const stepSlope = Math.abs(n.elev - cur.elev)
      const cost = (g.get(curK) ?? Infinity) + 1 + stepSlope * 4
      if (cost < (g.get(nk) ?? Infinity)) {
        came.set(nk, curK)
        g.set(nk, cost)
        f.set(nk, cost + hexDist(n, goal))
        open.add(nk)
      }
    }
  }
  return null
}

function addRoad(scene: THREE.Scene, pts: THREE.Vector3[], color: number) {
  if (pts.length < 2) return
  const geom = new THREE.BufferGeometry().setFromPoints(pts)
  const mat = new THREE.LineBasicMaterial({ color, linewidth: 1 })
  const line = new THREE.Line(geom, mat)
  line.position.y = TILE_H + 0.03
  scene.add(line)
}

export default function HexSandbox() {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const baseState = useGameStore((state) => state.hexState.base)
  const poiState = useGameStore((state) => state.hexState.pois)
  const setHexBase = useGameStore((state) => state.setHexBase)
  const setHexPois = useGameStore((state) => state.setHexPois)
  const setHexPoiCooldown = useGameStore((state) => state.setHexPoiCooldown)
  const tickHexPoiCooldowns = useGameStore((state) => state.tickHexPoiCooldowns)

  const baseRef = useRef<HexBaseState | null>(baseState)
  const poisRef = useRef<Record<string, HexPoiState>>(poiState)

  useEffect(() => {
    baseRef.current = baseState
  }, [baseState])

  useEffect(() => {
    poisRef.current = poiState
  }, [poiState])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.shadowMap.enabled = true
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0b0f14)

    const camera = new THREE.PerspectiveCamera(55, mount.clientWidth / mount.clientHeight, 0.1, 4000)
    camera.position.set(0, 140, 140)
    camera.lookAt(0, 0, 0)

    scene.add(new THREE.AmbientLight(0x334455, 0.35))
    const sun = new THREE.DirectionalLight(0xfff6da, 1)
    sun.position.set(200, 300, 160)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.camera.left = -400
    sun.shadow.camera.right = 400
    sun.shadow.camera.top = 400
    sun.shadow.camera.bottom = -400
    scene.add(sun)
    scene.add(new THREE.HemisphereLight(0xffffff, 0x1a2430, 0.4))

    const gridHelper = new THREE.GridHelper(1400, 140, 0x2a3542, 0x1b2834)
    scene.add(gridHelper)

    const cells: Cell[] = []
    const index = new Map<string, Cell>()
    const hexGroup = new THREE.Group()
    scene.add(hexGroup)

    const geom = new THREE.CylinderGeometry(HEX_SIZE, HEX_SIZE, TILE_H, 6, 1, false)
    for (let q = -GRID_RADIUS; q <= GRID_RADIUS; q += 1) {
      const r1 = Math.max(-GRID_RADIUS, -q - GRID_RADIUS)
      const r2 = Math.min(GRID_RADIUS, -q + GRID_RADIUS)
      for (let r = r1; r <= r2; r += 1) {
        const elev = elevAt(q, r)
        const water = elev < 0.36
        const mat = new THREE.MeshStandardMaterial({
          color: water ? WATER_COLOR : LAND_COLOR,
          roughness: 0.95,
          metalness: 0,
        })
        const tile = new THREE.Mesh(geom, mat)
        tile.receiveShadow = true
        tile.castShadow = false
        const pos = axialToWorld(q, r)
        tile.position.copy(pos)
        tile.position.y = water ? -0.04 : 0
        tile.userData = { q, r }
        hexGroup.add(tile)
        const cell: Cell = { q, r, pos, tile, elev, water }
        cells.push(cell)
        index.set(`${q},${r}`, cell)
      }
    }

    const hoverRing = new THREE.Mesh(
      new THREE.CylinderGeometry(HEX_SIZE * 1.03, HEX_SIZE * 1.03, TILE_H * 0.25, 48, 1, true),
      new THREE.MeshBasicMaterial({ color: HOVER_COLOR, wireframe: true })
    )
    hoverRing.visible = false
    scene.add(hoverRing)

    const poiGroup = new THREE.Group()
    scene.add(poiGroup)
    const pois: POI[] = []
    const poiLights: THREE.PointLight[] = []

    let baseSprite: THREE.Sprite | null = null
    let activeBase: Cell | null = null

    const applyBase = (cell: Cell | null, opts?: { fromStore?: boolean }) => {
      if (activeBase && activeBase !== cell) {
        const previousMaterial = activeBase.tile.material as THREE.MeshStandardMaterial
        previousMaterial.color.set(LAND_COLOR)
        activeBase.kind = undefined
      }
      if (!cell) {
        disposeSprite(baseSprite)
        if (baseSprite) scene.remove(baseSprite)
        baseSprite = null
        activeBase = null
        if (!opts?.fromStore) setHexBase(null)
        return
      }
      activeBase = cell
      activeBase.kind = 'base'
      const baseMaterial = cell.tile.material as THREE.MeshStandardMaterial
      baseMaterial.color.set(BASE_COLOR)
      disposeSprite(baseSprite)
      if (baseSprite) scene.remove(baseSprite)
      baseSprite = makeEmojiSprite('🏕️')
      baseSprite.position.set(cell.pos.x, baseSprite.position.y, cell.pos.z)
      scene.add(baseSprite)
      if (!opts?.fromStore) {
        setHexBase({ q: cell.q, r: cell.r, elevation: cell.elev, placedAt: Date.now() })
      }
    }

    const spawnPOIs = () => {
      const land = cells.filter((c) => !c.water)
      const picked: Cell[] = []
      const minRing = 3
      while (picked.length < POI_COUNT && land.length) {
        const candidate = land[Math.floor(Math.random() * land.length)]
        if (picked.every((p) => hexDist(p, candidate) >= minRing)) picked.push(candidate)
      }

      const nextPoiState: HexPoiState[] = []

      picked.forEach((cell, i) => {
        const type = POI_TYPES[i % POI_TYPES.length]
        const id = `poi-${cell.q}-${cell.r}`
        const sprite = makeEmojiSprite(type.emoji, 256, HEX_SIZE * 1.3)
        sprite.position.set(cell.pos.x, sprite.position.y, cell.pos.z)
        sprite.userData.kind = 'poi'
        const stored = poisRef.current[id]
        const cooldown = stored?.cooldown ?? 0
        if (cooldown > 0) {
          const material = sprite.material as THREE.SpriteMaterial
          material.opacity = 0.45
        }
        poiGroup.add(sprite)
        const glow = new THREE.PointLight(0xffd08a, 0.6, 30)
        glow.position.set(cell.pos.x, 2, cell.pos.z)
        scene.add(glow)
        poiLights.push(glow)
        pois.push({ id, cell, type: type.id, sprite, cooldown })
        nextPoiState.push({ id, type: type.id, q: cell.q, r: cell.r, cooldown })
      })

      setHexPois(nextPoiState)
    }

    spawnPOIs()

    if (baseRef.current) {
      const existing = index.get(`${baseRef.current.q},${baseRef.current.r}`)
      if (existing && !existing.water) {
        applyBase(existing, { fromStore: true })
      }
    }

    const buildHighways = () => {
      const edges: { a: POI; b: POI; d: number }[] = []
      for (let i = 0; i < pois.length; i += 1) {
        const sorted = pois
          .map((p, j) => ({ poi: p, j, d: hexDist(pois[i].cell, p.cell) }))
          .filter((entry) => entry.j !== i)
          .sort((a, b) => a.d - b.d)
          .slice(0, K_NEAREST)
        for (const s of sorted) {
          if (i < s.j) edges.push({ a: pois[i], b: s.poi, d: s.d })
        }
      }
      edges.sort((a, b) => a.d - b.d)

      const parent = new Map<POI, POI>()
      const find = (x: POI): POI => {
        const px = parent.get(x)
        if (!px || px === x) {
          parent.set(x, x)
          return x
        }
        const root = find(px)
        parent.set(x, root)
        return root
      }
      const unite = (a: POI, b: POI) => {
        const ra = find(a)
        const rb = find(b)
        if (ra !== rb) parent.set(ra, rb)
      }

      let connected = 0
      for (const edge of edges) {
        if (find(edge.a) !== find(edge.b)) {
          const path = findPath(edge.a.cell, edge.b.cell, index)
          if (path && path.length) {
            addRoad(
              scene,
              path.map((c) => new THREE.Vector3(c.pos.x, TILE_H + 0.03, c.pos.z)),
              ROAD_COLORS.highway
            )
            unite(edge.a, edge.b)
            connected += 1
          }
          if (connected >= pois.length - 1) break
        }
      }
    }

    const buildStreets = (radius = 7, fan = 6) => {
      for (const hub of pois) {
        const center = hub.cell
        for (const dir of axialDirs) {
          let current = center
          const chain: Cell[] = [current]
          for (let step = 0; step < radius; step += 1) {
            const nq = current.q + dir.q
            const nr = current.r + dir.r
            const next = index.get(`${nq},${nr}`)
            if (!next || next.water) break
            chain.push(next)
            current = next
          }
          if (chain.length > 2) {
            addRoad(scene, chain.map((c) => c.pos.clone()), ROAD_COLORS.street)
          }
        }

        for (let attempt = 0; attempt < fan; attempt += 1) {
          const anglePick = axialDirs[Math.floor(Math.random() * axialDirs.length)]
          let current = center
          const steps = 2 + Math.floor(Math.random() * Math.max(1, radius - 1))
          const chain: Cell[] = [current]
          for (let s = 0; s < steps; s += 1) {
            const jitter = axialDirs[(axialDirs.indexOf(anglePick) + (Math.random() < 0.5 ? 5 : 1)) % 6]
            const nq = current.q + jitter.q
            const nr = current.r + jitter.r
            const next = index.get(`${nq},${nr}`)
            if (!next || next.water) break
            chain.push(next)
            current = next
          }
          if (chain.length > 2) addRoad(scene, chain.map((c) => c.pos.clone()), ROAD_COLORS.street)
        }
      }
    }

    const buildSideStreets = (tries = 120) => {
      const nearestLand = (cell: Cell, maxRing = 3) => {
        for (let ring = 1; ring <= maxRing; ring += 1) {
          for (const dir of axialDirs) {
            const n = index.get(`${cell.q + dir.q * ring},${cell.r + dir.r * ring}`)
            if (n && !n.water) return n
          }
        }
        return null
      }

      for (let t = 0; t < tries; t += 1) {
        const a = cells[Math.floor(Math.random() * cells.length)]
        if (!a || a.water) continue
        const b = nearestLand(a, 3)
        if (!b) continue
        if (hexDist(a, b) <= 3) {
          const path = findPath(a, b, index)
          if (path && path.length >= 2) {
            addRoad(scene, path.map((c) => c.pos.clone()), ROAD_COLORS.side)
          }
        }
      }
    }

    buildHighways()
    buildStreets()
    buildSideStreets()

    const keys = new Set<string>()
    let sprint = false
    const onKeyDown = (event: KeyboardEvent) => {
      keys.add(event.key.toLowerCase())
      sprint = event.shiftKey
    }
    const onKeyUp = (event: KeyboardEvent) => {
      keys.delete(event.key.toLowerCase())
      sprint = event.shiftKey
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    const onWheel = (event: WheelEvent) => {
      const dz = Math.sign(event.deltaY) * 6
      camera.position.y = THREE.MathUtils.clamp(camera.position.y + dz, 30, 420)
    }
    renderer.domElement.addEventListener('wheel', onWheel, { passive: true })

    const ray = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    let hovered: THREE.Intersection | null = null

    const updateRay = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect()
      ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      ndc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      ray.setFromCamera(ndc, camera)
    }

    const onPointerMove = (event: MouseEvent) => {
      updateRay(event)
      let hits = ray.intersectObjects(poiGroup.children, true)
      if (hits.length === 0) {
        hits = ray.intersectObjects(hexGroup.children, false)
      }

      if (hits.length > 0) {
        if (hovered?.object !== hits[0].object) {
          if (hovered && (hovered.object as any).isMesh) {
            const prev = hovered.object as THREE.Mesh
            const c = cells.find((cell) => cell.tile === prev)
            if (c && c.kind !== 'base' && !c.water) {
              const material = prev.material as THREE.MeshStandardMaterial
              material.color.set(LAND_COLOR)
            }
          }
          hovered = hits[0]

          if ((hovered.object as any).isMesh) {
            const cur = hovered.object as THREE.Mesh
            const cell = cells.find((entry) => entry.tile === cur)
            if (!cell) return
            if (!cell.water && cell.kind !== 'base') {
              const material = cur.material as THREE.MeshStandardMaterial
              material.color.set(HOVER_COLOR)
            }
            hoverRing.position.set(cur.position.x, TILE_H * 0.6, cur.position.z)
            hoverRing.visible = !cell.water
          } else {
            hoverRing.visible = false
          }
        }
      } else {
        if (hovered && (hovered.object as any).isMesh) {
          const prev = hovered.object as THREE.Mesh
          const c = cells.find((cell) => cell.tile === prev)
          if (c && c.kind !== 'base' && !c.water) {
            const material = prev.material as THREE.MeshStandardMaterial
            material.color.set(LAND_COLOR)
          }
        }
        hovered = null
        hoverRing.visible = false
      }
    }

    const onClick = (event: MouseEvent) => {
      updateRay(event)
      let hits = ray.intersectObjects(poiGroup.children, true)
      if (hits.length > 0) {
        const sprite = hits[0].object as THREE.Sprite
        const poi = pois.find((p) => p.sprite === sprite)
        if (poi && poi.cooldown <= 0) {
          poi.cooldown = 30
          const material = sprite.material as THREE.SpriteMaterial
          material.opacity = 0.45
          setHexPoiCooldown(poi.id, 30)
          console.log(`Send scavengers to ${poi.type} at (${poi.cell.q}, ${poi.cell.r})`)
        }
        return
      }

      hits = ray.intersectObjects(hexGroup.children, false)
      if (hits.length === 0) return
      const mesh = hits[0].object as THREE.Mesh
      const cell = cells.find((c) => c.tile === mesh)
      if (!cell || cell.water) return

      applyBase(cell)
    }

    renderer.domElement.addEventListener('mousemove', onPointerMove)
    renderer.domElement.addEventListener('click', onClick)

    const onResize = () => {
      if (!mount) return
      const w = mount.clientWidth
      const h = mount.clientHeight
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }

    const ro = new ResizeObserver(onResize)
    ro.observe(mount)

    let raf = 0
    const up = new THREE.Vector3(0, 1, 0)
    const tmp = new THREE.Vector3()
    let elapsed = 0

    const tick = (t = 0) => {
      const dt = raf ? (t - (elapsed || t)) / 1000 : 0
      elapsed = t

      let hasCooldown = false
      for (const poi of pois) {
        if (poi.cooldown > 0) {
          hasCooldown = true
          poi.cooldown = Math.max(0, poi.cooldown - dt)
          if (poi.cooldown <= 0) {
            poi.cooldown = 0
            const material = poi.sprite.material as THREE.SpriteMaterial
            material.opacity = 1
          }
        }
      }
      if (hasCooldown) {
        tickHexPoiCooldowns(dt)
      }

      const baseSpeed = 0.65
      const speed = sprint ? baseSpeed * 2 : baseSpeed

      tmp.set(0, 0, 0)
      if (keys.has('w')) tmp.z -= 1
      if (keys.has('s')) tmp.z += 1
      if (keys.has('a')) tmp.x -= 1
      if (keys.has('d')) tmp.x += 1

      if (keys.has('q')) camera.rotateOnWorldAxis(up, 0.012)
      if (keys.has('e')) camera.rotateOnWorldAxis(up, -0.012)

      if (tmp.lengthSq() > 0) {
        tmp.normalize()
        const yaw = new THREE.Euler(0, camera.rotation.y, 0, 'YXZ')
        tmp.applyEuler(yaw).multiplyScalar(speed)
        camera.position.add(tmp)
      }

      renderer.render(scene, camera)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      renderer.domElement.removeEventListener('wheel', onWheel)
      renderer.domElement.removeEventListener('mousemove', onPointerMove)
      renderer.domElement.removeEventListener('click', onClick)
      poiGroup.children.forEach((child) => {
        if (child instanceof THREE.Sprite) {
          const mat = child.material as THREE.SpriteMaterial
          mat.map?.dispose()
          mat.dispose()
        }
      })
      poiLights.forEach((light) => {
        scene.remove(light)
      })
      disposeSprite(baseSprite)
      renderer.dispose()
      hoverRing.geometry.dispose()
      const hoverMaterial = hoverRing.material as THREE.Material
      hoverMaterial.dispose()
      geom.dispose()
      mount.removeChild(renderer.domElement)
    }
  }, [setHexBase, setHexPoiCooldown, setHexPois, tickHexPoiCooldowns])

  return <div className="world-3d-map" ref={mountRef} />
}

