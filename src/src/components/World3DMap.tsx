import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { useGameStore } from '../state/useGameStore'

const TERRAIN_SIZE = 160
const MAP_RESOLUTION = 129 // 128 segments + 1 to close the grid

interface Heightmap {
  size: number
  data: number[][]
}

interface Polyline {
  path: { x: number; y: number; height: number }[]
}

interface RawSettlement {
  id: string
  gridX: number
  gridY: number
  height: number
  name: string
}

interface WorldData {
  heightmap: Heightmap
  settlements: RawSettlement[]
  rivers: Polyline[]
  roads: { start: RawSettlement; end: RawSettlement }[]
}

type SeededRandom = () => number

function createSeededRandom(seed: string): SeededRandom {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i += 1) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }

  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return (h >>> 0) / 4294967296
  }
}

function generateHeightmap(size: number, roughness: number, random: SeededRandom): Heightmap {
  const data = Array.from({ length: size }, () => new Array<number>(size).fill(0))
  const maxIndex = size - 1

  data[0][0] = random()
  data[0][maxIndex] = random()
  data[maxIndex][0] = random()
  data[maxIndex][maxIndex] = random()

  let step = maxIndex
  let scale = 1

  while (step > 1) {
    const half = Math.floor(step / 2)

    for (let y = 0; y < maxIndex; y += step) {
      for (let x = 0; x < maxIndex; x += step) {
        const avg =
          (data[y][x] +
            data[y + step][x] +
            data[y][x + step] +
            data[y + step][x + step]) /
          4
        data[y + half][x + half] = avg + (random() * 2 - 1) * scale
      }
    }

    for (let y = 0; y <= maxIndex; y += half) {
      for (let x = (y / half) % 2 === 0 ? half : 0; x <= maxIndex; x += step) {
        const neighbors: number[] = []
        if (x >= half) neighbors.push(data[y][x - half])
        if (x + half <= maxIndex) neighbors.push(data[y][x + half])
        if (y >= half) neighbors.push(data[y - half][x])
        if (y + half <= maxIndex) neighbors.push(data[y + half][x])
        const avg = neighbors.reduce((acc, value) => acc + value, 0) / neighbors.length
        data[y][x] = avg + (random() * 2 - 1) * scale
      }
    }

    step = half
    scale *= roughness
  }

  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      min = Math.min(min, data[y][x])
      max = Math.max(max, data[y][x])
    }
  }
  const range = max - min || 1
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      data[y][x] = (data[y][x] - min) / range
    }
  }

  return { data, size }
}

function generateSettlements(
  heightmap: Heightmap,
  random: SeededRandom,
  count: number
): RawSettlement[] {
  const settlements: RawSettlement[] = []
  const { data, size } = heightmap
  let attempts = 0
  while (settlements.length < count && attempts < count * 10) {
    attempts += 1
    const gridX = Math.floor(random() * size)
    const gridY = Math.floor(random() * size)
    const height = data[gridY][gridX]
    if (height < 0.32 || height > 0.85) continue
    const id = `settlement-${settlements.length}`
    const name = `Enclave ${String.fromCharCode(65 + settlements.length)}`
    settlements.push({ id, gridX, gridY, height, name })
  }
  return settlements
}

function neighborhood(heightmap: Heightmap, x: number, y: number) {
  const deltas = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ]
  const neighbors: { x: number; y: number; height: number }[] = []
  for (const [dx, dy] of deltas) {
    const nx = x + dx
    const ny = y + dy
    if (nx >= 0 && nx < heightmap.size && ny >= 0 && ny < heightmap.size) {
      neighbors.push({ x: nx, y: ny, height: heightmap.data[ny][nx] })
    }
  }
  return neighbors
}

function generateRivers(
  heightmap: Heightmap,
  random: SeededRandom,
  count: number,
  seaLevel: number
): Polyline[] {
  const rivers: Polyline[] = []
  let attempts = 0
  const maxSteps = heightmap.size * 2
  while (rivers.length < count && attempts < count * 12) {
    attempts += 1
    let x = Math.floor(random() * heightmap.size)
    let y = Math.floor(random() * heightmap.size)
    if (heightmap.data[y][x] < seaLevel + 0.05) continue
    const path: Polyline['path'] = []
    const visited = new Set<string>()
    for (let step = 0; step < maxSteps; step += 1) {
      const key = `${x}:${y}`
      if (visited.has(key)) break
      visited.add(key)
      const height = heightmap.data[y][x]
      path.push({ x, y, height })
      const neighbors = neighborhood(heightmap, x, y).sort((a, b) => a.height - b.height)
      const next = neighbors.find((candidate) => candidate.height <= height)
      if (!next) break
      x = next.x
      y = next.y
      if (heightmap.data[y][x] <= seaLevel) {
        path.push({ x, y, height: heightmap.data[y][x] })
        break
      }
    }
    if (path.length > 6) {
      rivers.push({ path })
    }
  }
  return rivers
}

function generateRoads(settlements: RawSettlement[]): {
  start: RawSettlement
  end: RawSettlement
}[] {
  const roads: { start: RawSettlement; end: RawSettlement }[] = []
  if (settlements.length < 2) return roads
  for (let i = 0; i < settlements.length; i += 1) {
    const start = settlements[i]
    const end = settlements[(i + 1) % settlements.length]
    roads.push({ start, end })
  }
  return roads
}

function mapToWorld(value: number, size: number, span: number) {
  return (value / (size - 1) - 0.5) * span
}

function disposeLine(child: THREE.Object3D) {
  if (child instanceof THREE.Line) {
    child.geometry.dispose()
    const material = child.material
    if (Array.isArray(material)) {
      material.forEach((mat) => mat.dispose())
    } else {
      material.dispose()
    }
  }
}

function buildRiverLine(
  group: THREE.Group,
  polyline: Polyline,
  heightScale: number,
  color: THREE.ColorRepresentation
) {
  const points = polyline.path.map(({ x, y, height }) =>
    new THREE.Vector3(
      mapToWorld(x, MAP_RESOLUTION, TERRAIN_SIZE),
      mapToWorld(y, MAP_RESOLUTION, TERRAIN_SIZE),
      height * heightScale + 0.2
    )
  )
  const geometry = new THREE.BufferGeometry().setFromPoints(points)
  const material = new THREE.LineBasicMaterial({ color, linewidth: 1, transparent: true, opacity: 0.95 })
  const line = new THREE.Line(geometry, material)
  group.add(line)
}

function buildRoadLine(group: THREE.Group, start: RawSettlement, end: RawSettlement, heightScale: number) {
  const startVector = new THREE.Vector3(
    mapToWorld(start.gridX, MAP_RESOLUTION, TERRAIN_SIZE),
    mapToWorld(start.gridY, MAP_RESOLUTION, TERRAIN_SIZE),
    start.height * heightScale + 0.3
  )
  const endVector = new THREE.Vector3(
    mapToWorld(end.gridX, MAP_RESOLUTION, TERRAIN_SIZE),
    mapToWorld(end.gridY, MAP_RESOLUTION, TERRAIN_SIZE),
    end.height * heightScale + 0.3
  )
  const control = startVector.clone().lerp(endVector, 0.5)
  control.z += 2
  const curve = new THREE.QuadraticBezierCurve3(startVector, control, endVector)
  const points = curve.getPoints(24)
  const geometry = new THREE.BufferGeometry().setFromPoints(points)
  const material = new THREE.LineDashedMaterial({ color: 0xd9a066, dashSize: 2, gapSize: 1 })
  const line = new THREE.Line(geometry, material)
  line.computeLineDistances()
  group.add(line)
}

function createMarkerSprite(label: string, color: string) {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Unable to create canvas context for marker')
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(64, 64, 40, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#111'
  ctx.font = 'bold 40px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, 64, 66)
  const texture = new THREE.CanvasTexture(canvas)
  texture.anisotropy = 4
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true })
  const sprite = new THREE.Sprite(material)
  sprite.scale.set(6, 6, 6)
  return {
    sprite,
    dispose: () => {
      texture.dispose()
      material.dispose()
    },
  }
}

const World3DMap = () => {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const frameRef = useRef<number>()
  const terrainMeshRef = useRef<THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial> | null>(null)
  const riverGroupRef = useRef<THREE.Group>(new THREE.Group())
  const roadGroupRef = useRef<THREE.Group>(new THREE.Group())
  const markerGroupRef = useRef<THREE.Group>(new THREE.Group())
  const waterMeshRef = useRef<THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> | null>(null)

  const seed = useGameStore((state) => state.seed)
  const elevationScale = useGameStore((state) => state.elevationScale)
  const seaLevel = useGameStore((state) => state.seaLevel)
  const overlayVisibility = useGameStore((state) => state.overlayVisibility)
  const setSettlements = useGameStore((state) => state.setSettlements)
  const selectSettlement = useGameStore((state) => state.selectSettlement)
  const selectedSettlementId = useGameStore((state) => state.selectedSettlementId)

  const worldData = useMemo<WorldData>(() => {
    const random = createSeededRandom(seed)
    const heightmap = generateHeightmap(MAP_RESOLUTION, 0.55, random)
    const settlements = generateSettlements(heightmap, random, 6)
    const rivers = generateRivers(heightmap, random, 4, seaLevel)
    const roads = generateRoads(settlements)
    return { heightmap, settlements, rivers, roads }
  }, [seed, seaLevel])

  const settlementPayload = useMemo(
    () =>
      worldData.settlements.map((settlement) => ({
        id: settlement.id,
        name: settlement.name,
        position: {
          x: mapToWorld(settlement.gridX, MAP_RESOLUTION, TERRAIN_SIZE),
          y: mapToWorld(settlement.gridY, MAP_RESOLUTION, TERRAIN_SIZE),
          elevation: settlement.height,
        },
      })),
    [worldData]
  )

  useEffect(() => {
    setSettlements(settlementPayload)
    if (
      selectedSettlementId &&
      !settlementPayload.some((settlement) => settlement.id === selectedSettlementId)
    ) {
      selectSettlement(null)
    }
  }, [settlementPayload, selectedSettlementId, selectSettlement, setSettlements])

  useEffect(() => {
    if (!mountRef.current) return

    const width = mountRef.current.clientWidth || mountRef.current.offsetWidth
    const height = mountRef.current.clientHeight || 600

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#0c111d')
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000)
    camera.position.set(0, -TERRAIN_SIZE * 1.4, TERRAIN_SIZE * 0.9)
    camera.up.set(0, 0, 1)
    camera.lookAt(0, 0, 0)
    cameraRef.current = camera

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(width, height)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    rendererRef.current = renderer
    mountRef.current.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.maxPolarAngle = Math.PI / 2.05
    controls.minDistance = 40
    controls.maxDistance = 280
    const ambient = new THREE.AmbientLight(0xe2e6f3, 0.55)
    scene.add(ambient)
    const directional = new THREE.DirectionalLight(0xffffff, 0.85)
    directional.position.set(60, -40, 80)
    scene.add(directional)

    const terrainGeometry = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, MAP_RESOLUTION - 1, MAP_RESOLUTION - 1)
    const terrainMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true })
    const terrainMesh = new THREE.Mesh(terrainGeometry, terrainMaterial)
    terrainMesh.receiveShadow = true
    terrainMesh.castShadow = false
    scene.add(terrainMesh)
    terrainMeshRef.current = terrainMesh

    const waterGeometry = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, 1, 1)
    const waterMaterial = new THREE.MeshBasicMaterial({ color: 0x406cff, transparent: true, opacity: 0.32 })
    const waterMesh = new THREE.Mesh(waterGeometry, waterMaterial)
    waterMesh.rotation.z = 0
    waterMeshRef.current = waterMesh
    scene.add(waterMesh)

    riverGroupRef.current.name = 'rivers'
    roadGroupRef.current.name = 'roads'
    markerGroupRef.current.name = 'settlements'
    scene.add(riverGroupRef.current)
    scene.add(roadGroupRef.current)
    scene.add(markerGroupRef.current)

    const animate = () => {
      controls.update()
      renderer.render(scene, camera)
      frameRef.current = requestAnimationFrame(animate)
    }
    animate()

    const handleResize = () => {
      if (!mountRef.current || !rendererRef.current || !cameraRef.current) return
      const bounds = mountRef.current.getBoundingClientRect()
      rendererRef.current.setSize(bounds.width, bounds.height)
      cameraRef.current.aspect = bounds.width / bounds.height
      cameraRef.current.updateProjectionMatrix()
    }

    window.addEventListener('resize', handleResize)

    return () => {
      cancelAnimationFrame(frameRef.current ?? 0)
      window.removeEventListener('resize', handleResize)
      controls.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
      terrainGeometry.dispose()
      terrainMaterial.dispose()
      waterGeometry.dispose()
      waterMaterial.dispose()
      scene.clear()
    }
  }, [])

  useEffect(() => {
    if (!terrainMeshRef.current || !sceneRef.current) return

    const { heightmap, rivers, roads, settlements } = worldData
    const geometry = terrainMeshRef.current.geometry
    const positionAttr = geometry.getAttribute('position') as THREE.BufferAttribute
    let colorAttr = geometry.getAttribute('color') as THREE.BufferAttribute | null
    if (!colorAttr || colorAttr.count !== positionAttr.count) {
      colorAttr = new THREE.BufferAttribute(new Float32Array(positionAttr.count * 3), 3)
      geometry.setAttribute('color', colorAttr)
    }

    for (let i = 0; i < positionAttr.count; i += 1) {
      const gridX = i % MAP_RESOLUTION
      const gridY = Math.floor(i / MAP_RESOLUTION)
      const height = heightmap.data[gridY][gridX]
      positionAttr.setZ(i, height * elevationScale)
      const color = new THREE.Color()
      if (overlayVisibility.heightTint) {
        if (height <= seaLevel) {
          color.setRGB(0.15, 0.3, 0.58)
        } else if (height <= seaLevel + 0.08) {
          color.setRGB(0.21, 0.38, 0.24)
        } else if (height > 0.75) {
          color.setRGB(0.75, 0.76, 0.79)
        } else {
          const green = THREE.MathUtils.lerp(0.36, 0.55, height)
          color.setRGB(0.24, green, 0.28)
        }
      } else {
        color.setRGB(0.38, 0.44, 0.46)
      }
      colorAttr.setXYZ(i, color.r, color.g, color.b)
    }

    positionAttr.needsUpdate = true
    colorAttr.needsUpdate = true
    geometry.computeVertexNormals()

    if (waterMeshRef.current) {
      waterMeshRef.current.position.set(0, 0, seaLevel * elevationScale)
    }

    riverGroupRef.current.children.forEach(disposeLine)
    riverGroupRef.current.clear()
    if (overlayVisibility.rivers) {
      for (const river of rivers) {
        buildRiverLine(riverGroupRef.current, river, elevationScale, '#5ec0ff')
      }
    }

    roadGroupRef.current.children.forEach(disposeLine)
    roadGroupRef.current.clear()
    if (overlayVisibility.roads) {
      for (const road of roads) {
        buildRoadLine(roadGroupRef.current, road.start, road.end, elevationScale)
      }
    }

    markerGroupRef.current.children.forEach((child: THREE.Object3D) => {
      const sprite = child as THREE.Sprite
      const disposeMarker = sprite.userData?.dispose as (() => void) | undefined
      disposeMarker?.()
    })
    markerGroupRef.current.clear()
    if (overlayVisibility.settlements) {
      settlements.forEach((settlement, index) => {
        const { sprite, dispose } = createMarkerSprite(String.fromCharCode(65 + index), '#ffd166')
        const worldX = mapToWorld(settlement.gridX, MAP_RESOLUTION, TERRAIN_SIZE)
        const worldY = mapToWorld(settlement.gridY, MAP_RESOLUTION, TERRAIN_SIZE)
        sprite.position.set(worldX, worldY, settlement.height * elevationScale + 2.5)
        sprite.userData = { id: settlement.id, dispose }
        markerGroupRef.current?.add(sprite)
      })
    }

    return undefined
  }, [worldData, elevationScale, overlayVisibility, seaLevel])

  useEffect(() => {
    riverGroupRef.current.visible = overlayVisibility.rivers
  }, [overlayVisibility.rivers])

  useEffect(() => {
    roadGroupRef.current.visible = overlayVisibility.roads
  }, [overlayVisibility.roads])

  useEffect(() => {
    markerGroupRef.current.visible = overlayVisibility.settlements
  }, [overlayVisibility.settlements])

  useEffect(() => {
    if (!rendererRef.current || !cameraRef.current) return
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()

    const handlePointerDown = (event: PointerEvent) => {
      if (!rendererRef.current || !cameraRef.current) return
      const bounds = rendererRef.current.domElement.getBoundingClientRect()
      pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1
      pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1
      raycaster.setFromCamera(pointer, cameraRef.current)
      const intersections = raycaster.intersectObjects(markerGroupRef.current.children, true)
      if (intersections.length > 0) {
        const id = intersections[0].object.userData?.id as string | undefined
        if (id) {
          selectSettlement(id)
          return
        }
      }
      selectSettlement(null)
    }

    const canvas = rendererRef.current.domElement
    canvas.addEventListener('pointerdown', handlePointerDown)
    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [selectSettlement])

  useEffect(() => {
    markerGroupRef.current.children.forEach((child: THREE.Object3D) => {
      const sprite = child as THREE.Sprite
      const id = sprite.userData?.id
      if (id === selectedSettlementId) {
        sprite.scale.setScalar(7.2)
      } else {
        sprite.scale.setScalar(6)
      }
    })
  }, [selectedSettlementId])

  return <div className="world-3d-map" ref={mountRef} />
}

export default World3DMap
