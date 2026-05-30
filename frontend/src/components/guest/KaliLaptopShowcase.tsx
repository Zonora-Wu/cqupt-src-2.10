import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { ENVIRONMENT_MAP_URL, LAPTOP_MODEL_URL } from './laptopShowcaseAssets'

const ENVIRONMENT_ROTATION_Y_DEGREES = 20
const MODEL_VERTICAL_OFFSET = -0.3
const LID_OPEN_DELTA_DEGREES = -108
const LID_ANIMATION_SECONDS = 1.05
const KEY_PRESS_DEPTH = 0.0025
const KEY_PRESS_DOWN_SECONDS = 0.07
const KEY_RELEASE_SECONDS = 0.14

let laptopModelPromise: Promise<THREE.Group> | null = null
let environmentTexturePromise: Promise<THREE.DataTexture> | null = null

type SceneTheme = 'dark' | 'light'

type LaptopSceneProps = {
  baseCanvasHeight: number
  dragRotation: { x: number; y: number }
  lidOpen: boolean
  onKeyboardPress: () => void
  theme: SceneTheme
}

type LaptopModel = {
  lid: THREE.Object3D | null
  root: THREE.Group
}

type LidAnimation = {
  from: number
  startedAt: number
  to: number
}

type PointerState = {
  dragging: boolean
  lastX: number
  lastY: number
  travel: number
}

type KeyPressState = {
  currentOffset: number
  object: THREE.Object3D
  originalY: number
  pressedAt: number
  pressStartOffset: number
  releasedAt: number | null
  releaseStartOffset: number
}

type CanvasBounds = {
  baseHeight: number
  bottom: number
  top: number
}

export function preloadKaliLaptopShowcaseResources() {
  void loadLaptopModel()
  void loadEnvironmentTexture()
}

export function KaliLaptopShowcase() {
  const sceneRef = useRef<HTMLDivElement | null>(null)
  const pointerRef = useRef<PointerState>({ dragging: false, lastX: 0, lastY: 0, travel: 0 })
  const suppressNextClickRef = useRef(false)
  const [canvasBounds, setCanvasBounds] = useState<CanvasBounds>(() => getBaseCanvasBounds())
  const [dragRotation, setDragRotation] = useState({ x: 0, y: 0 })
  const [lidOpen, setLidOpen] = useState(false)
  const theme = useSceneTheme()

  useEffect(() => {
    let frame = 0

    const update = () => {
      frame = 0
      const element = sceneRef.current
      if (!element) return

      const rect = element.getBoundingClientRect()
      setCanvasBounds((current) => {
        const next = getCanvasBounds(rect)
        return current.top === next.top && current.bottom === next.bottom ? current : next
      })
    }

    const requestUpdate = () => {
      if (frame) return
      frame = window.requestAnimationFrame(update)
    }

    update()
    window.addEventListener('resize', requestUpdate)

    return () => {
      window.removeEventListener('resize', requestUpdate)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <div className="relative z-[80] mx-auto h-[620px] max-w-7xl overflow-visible md:h-[760px]" ref={sceneRef}>
      <div
        aria-label="ROG 笔记本电脑 3D 模型展示，可拖动查看"
        className="absolute -inset-x-20 z-[90] cursor-grab touch-none select-none active:cursor-grabbing md:-inset-x-36"
        onPointerCancel={stopDragging}
        onPointerDown={(event) => {
          pointerRef.current = { dragging: true, lastX: event.clientX, lastY: event.clientY, travel: 0 }
          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerLeave={stopDragging}
        onPointerMove={(event) => {
          const pointer = pointerRef.current
          if (!pointer.dragging) return

          const deltaX = event.clientX - pointer.lastX
          const deltaY = event.clientY - pointer.lastY
          pointerRef.current = {
            dragging: true,
            lastX: event.clientX,
            lastY: event.clientY,
            travel: pointer.travel + Math.hypot(deltaX, deltaY),
          }
          setDragRotation((current) => ({
            x: current.x - deltaY * 0.16,
            y: current.y + deltaX * 0.18,
          }))
        }}
        onPointerUp={(event) => {
          const wasClick = pointerRef.current.travel < 6
          const shouldToggleLid = wasClick && !suppressNextClickRef.current
          suppressNextClickRef.current = false
          stopDragging(event)
          if (shouldToggleLid) setLidOpen((current) => !current)
        }}
        style={{ bottom: -canvasBounds.bottom, top: -canvasBounds.top }}
      >
        <Canvas
          camera={{ fov: 28, position: [0, 1.18, 9.4] }}
          className="h-full w-full"
          dpr={[1, 1.75]}
          gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
          onCreated={({ gl }) => {
            gl.outputColorSpace = THREE.SRGBColorSpace
            gl.toneMapping = THREE.ACESFilmicToneMapping
            gl.toneMappingExposure = theme === 'dark' ? 1.05 : 0.92
          }}
        >
          <ExrEnvironment exposure={theme === 'dark' ? 1.05 : 0.92} />
          <LaptopScene
            baseCanvasHeight={canvasBounds.baseHeight}
            dragRotation={dragRotation}
            lidOpen={lidOpen}
            onKeyboardPress={() => {
              suppressNextClickRef.current = true
              pointerRef.current.travel = 999
            }}
            theme={theme}
          />
        </Canvas>
      </div>
    </div>
  )

  function stopDragging(event: React.PointerEvent<HTMLDivElement>) {
    pointerRef.current.dragging = false
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }
}

function useSceneTheme(): SceneTheme {
  const [theme, setTheme] = useState<SceneTheme>(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light',
  )

  useEffect(() => {
    const root = document.documentElement
    const updateTheme = () => setTheme(root.classList.contains('dark') ? 'dark' : 'light')
    const observer = new MutationObserver(updateTheme)

    updateTheme()
    observer.observe(root, { attributeFilter: ['class'], attributes: true })
    return () => observer.disconnect()
  }, [])

  return theme
}

function getBaseCanvasBounds(): CanvasBounds {
  const isDesktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches
  const sceneHeight = isDesktop ? 760 : 620
  const bottom = isDesktop ? 128 : 96
  const top = isDesktop ? 128 : 96
  return {
    baseHeight: sceneHeight + top + bottom,
    bottom,
    top,
  }
}

function getCanvasBounds(sceneRect: DOMRect): CanvasBounds {
  const base = getBaseCanvasBounds()
  const navBottom = document.querySelector('nav')?.getBoundingClientRect().bottom ?? 64
  return {
    baseHeight: base.baseHeight,
    bottom: base.bottom,
    top: Math.max(base.top, Math.ceil(sceneRect.top - navBottom)),
  }
}

function ExrEnvironment({ exposure }: { exposure: number }) {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)

  useEffect(() => {
    let disposed = false
    const pmrem = new THREE.PMREMGenerator(gl)

    pmrem.compileEquirectangularShader()

    loadEnvironmentTexture()
      .then((texture) => {
        const environmentMap = pmrem.fromEquirectangular(texture).texture

        if (disposed) {
          environmentMap.dispose()
          return
        }

        scene.environment = environmentMap
        scene.environmentRotation.y = THREE.MathUtils.degToRad(ENVIRONMENT_ROTATION_Y_DEGREES)
      })
      .catch((error) => {
        console.error('Failed to load EXR environment:', error)
      })

    return () => {
      disposed = true
      const currentEnvironment = scene.environment
      scene.environment = null
      scene.environmentRotation.set(0, 0, 0)
      currentEnvironment?.dispose()
      pmrem.dispose()
    }
  }, [gl, scene])

  useEffect(() => {
    gl.toneMappingExposure = exposure
  }, [exposure, gl])

  return null
}

function LaptopScene({ baseCanvasHeight, dragRotation, lidOpen, onKeyboardPress, theme }: LaptopSceneProps) {
  const groupRef = useRef<THREE.Group | null>(null)
  const lidRef = useRef<THREE.Object3D | null>(null)
  const lidClosedRotationXRef = useRef(0)
  const lidAnimationRef = useRef<LidAnimation>({ from: 0, startedAt: 0, to: 0 })
  const lidProgressRef = useRef(0)
  const keyPressesRef = useRef<Map<string, KeyPressState>>(new Map())
  const activePointerKeysRef = useRef<Map<number, string>>(new Map())
  const [model, setModel] = useState<THREE.Group | null>(null)
  const viewportSize = useThree((state) => state.size)

  useEffect(() => {
    lidAnimationRef.current = {
      from: lidProgressRef.current,
      startedAt: performance.now() * 0.001,
      to: lidOpen ? 1 : 0,
    }
  }, [lidOpen])

  useEffect(() => {
    let cancelled = false
    loadLaptopModel()
      .then((source) => {
        if (cancelled) return
        const normalized = normalizeLaptopModel(source)
        lidRef.current = normalized.lid
        lidClosedRotationXRef.current = normalized.lid?.rotation.x ?? 0
        setModel(normalized.root)
      })
      .catch((error) => {
        console.error('Failed to load ROG laptop model:', error)
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!model) return
    applyLaptopTheme(model, theme)
  }, [model, theme])

  useEffect(() => {
    const releaseAllKeys = () => {
      activePointerKeysRef.current.clear()
      const now = performance.now() * 0.001

      for (const press of keyPressesRef.current.values()) {
        if (press.releasedAt !== null) continue
        press.releasedAt = now
        press.releaseStartOffset = press.currentOffset
      }
    }

    window.addEventListener('blur', releaseAllKeys)
    window.addEventListener('pointerup', releaseAllKeys)
    window.addEventListener('pointercancel', releaseAllKeys)

    return () => {
      window.removeEventListener('blur', releaseAllKeys)
      window.removeEventListener('pointerup', releaseAllKeys)
      window.removeEventListener('pointercancel', releaseAllKeys)
    }
  }, [])

  useFrame(() => {
    const group = groupRef.current
    if (!group) return

    const elapsed = performance.now() * 0.001
    const idleBreath = Math.sin(elapsed * 0.92) * 0.032
    const scaleCompensation = viewportSize.height > 0 ? baseCanvasHeight / viewportSize.height : 1

    group.position.y = THREE.MathUtils.lerp(
      group.position.y,
      MODEL_VERTICAL_OFFSET + 0.09 + idleBreath,
      0.075,
    )
    group.position.z = THREE.MathUtils.lerp(group.position.z, 0.18, 0.075)
    group.rotation.x = THREE.MathUtils.lerp(group.rotation.x, THREE.MathUtils.degToRad(-3 + dragRotation.x), 0.075)
    group.rotation.y = THREE.MathUtils.lerp(group.rotation.y, THREE.MathUtils.degToRad(-16 + dragRotation.y), 0.075)
    group.rotation.z = THREE.MathUtils.lerp(group.rotation.z, THREE.MathUtils.degToRad(-0.8), 0.075)
    group.scale.setScalar(THREE.MathUtils.lerp(group.scale.x, scaleCompensation, 0.06))

    const lid = lidRef.current
    if (lid) {
      const animation = lidAnimationRef.current
      const closedRotationX = lidClosedRotationXRef.current
      const elapsedSinceToggle = elapsed - animation.startedAt
      const rawProgress = THREE.MathUtils.clamp(elapsedSinceToggle / LID_ANIMATION_SECONDS, 0, 1)
      const easedProgress = smootherstep(rawProgress)
      const lidProgress = THREE.MathUtils.lerp(animation.from, animation.to, easedProgress)
      const idleLidMotion = lidProgress > 0.96 ? Math.sin(elapsed * 0.92) * 0.012 : 0
      lidProgressRef.current = lidProgress
      lid.rotation.x = closedRotationX + THREE.MathUtils.degToRad(LID_OPEN_DELTA_DEGREES * lidProgress) + idleLidMotion
    }

    for (const [id, press] of keyPressesRef.current) {
      if (press.releasedAt === null) {
        const progress = smootherstep(THREE.MathUtils.clamp((elapsed - press.pressedAt) / KEY_PRESS_DOWN_SECONDS, 0, 1))
        press.currentOffset = THREE.MathUtils.lerp(press.pressStartOffset, -KEY_PRESS_DEPTH, progress)
        press.object.position.y = press.originalY + press.currentOffset
        continue
      }

      const progress = smootherstep(THREE.MathUtils.clamp((elapsed - press.releasedAt) / KEY_RELEASE_SECONDS, 0, 1))
      press.currentOffset = THREE.MathUtils.lerp(press.releaseStartOffset, 0, progress)
      press.object.position.y = press.originalY + press.currentOffset

      if (progress >= 1) {
        press.object.position.y = press.originalY
        keyPressesRef.current.delete(id)
      }
    }
  })

  return (
    <group ref={groupRef}>
      {model && (
        <primitive
          object={model}
          onPointerDown={(event: ThreeEvent<PointerEvent>) => {
            const key = findKeyboardKey(event.object)
            if (!key) return

            event.stopPropagation()
            event.nativeEvent.stopPropagation()
            if (event.target instanceof Element) {
              event.target.setPointerCapture(event.pointerId)
            }
            onKeyboardPress()

            const now = performance.now() * 0.001
            const current = keyPressesRef.current.get(key.uuid)
            activePointerKeysRef.current.set(event.pointerId, key.uuid)
            keyPressesRef.current.set(key.uuid, {
              currentOffset: current?.currentOffset ?? 0,
              object: key,
              originalY: current?.originalY ?? key.position.y,
              pressedAt: now,
              pressStartOffset: current?.currentOffset ?? 0,
              releasedAt: null,
              releaseStartOffset: current?.currentOffset ?? 0,
            })
          }}
          onPointerCancel={(event: ThreeEvent<PointerEvent>) => {
            releaseKeyboardKeyForPointer(event.pointerId)
          }}
          onPointerLeave={(event: ThreeEvent<PointerEvent>) => {
            releaseKeyboardKeyForPointer(event.pointerId)
          }}
          onLostPointerCapture={(event: ThreeEvent<PointerEvent>) => {
            releaseKeyboardKeyForPointer(event.pointerId)
          }}
          onPointerUp={(event: ThreeEvent<PointerEvent>) => {
            releaseKeyboardKeyForPointer(event.pointerId)
            if (event.target instanceof Element && event.target.hasPointerCapture(event.pointerId)) {
              event.target.releasePointerCapture(event.pointerId)
            }
          }}
        />
      )}
    </group>
  )

  function releaseKeyboardKeyForPointer(pointerId: number) {
    const keyId = activePointerKeysRef.current.get(pointerId)
    if (!keyId) return

    activePointerKeysRef.current.delete(pointerId)
    releaseKeyboardKey(keyId)
  }

  function releaseKeyboardKey(keyId: string) {
    const press = keyPressesRef.current.get(keyId)
    if (!press || press.releasedAt !== null) return

    press.releasedAt = performance.now() * 0.001
    press.releaseStartOffset = press.currentOffset
  }
}

function loadLaptopModel() {
  laptopModelPromise ??= new Promise<THREE.Group>((resolve, reject) => {
    new GLTFLoader().load(LAPTOP_MODEL_URL, (gltf) => resolve(gltf.scene), undefined, reject)
  })

  return laptopModelPromise
}

function loadEnvironmentTexture() {
  environmentTexturePromise ??= new Promise<THREE.DataTexture>((resolve, reject) => {
    new EXRLoader().load(ENVIRONMENT_MAP_URL, resolve, undefined, reject)
  })

  return environmentTexturePromise
}

function findKeyboardKey(object: THREE.Object3D): THREE.Object3D | null {
  let current: THREE.Object3D | null = object

  while (current) {
    if (current instanceof THREE.Mesh && current.name.includes('键') && current.name !== '键盘') {
      return current
    }
    current = current.parent
  }

  return null
}

function normalizeLaptopModel(source: THREE.Group): LaptopModel {
  const model = source.clone(true)
  const lid = model.getObjectByName('ab面') ?? null
  const box = new THREE.Box3().setFromObject(model)
  const size = new THREE.Vector3()
  const center = new THREE.Vector3()
  box.getSize(size)
  box.getCenter(center)

  const maxAxis = Math.max(size.x, size.y, size.z) || 1
  const scale = 3.55 / maxAxis
  model.position.set(-center.x * scale, -center.y * scale - 0.18, -center.z * scale)
  model.scale.setScalar(scale)

  model.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    object.frustumCulled = false

    const materials = Array.isArray(object.material) ? object.material : [object.material]
    materials.forEach((material) => {
      if (!material || !(material instanceof THREE.MeshStandardMaterial)) return
      material.envMapIntensity = 0.72
      material.roughness = Math.max(material.roughness, 0.28)
      material.metalness = Math.min(material.metalness, 0.86)
    })
  })

  return { lid, root: model }
}

function applyLaptopTheme(model: THREE.Group, theme: SceneTheme) {
  model.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    const materials = Array.isArray(object.material) ? object.material : [object.material]

    materials.forEach((material) => {
      if (!(material instanceof THREE.MeshStandardMaterial)) return
      applyMaterialTheme(material, theme)
    })
  })
}

function applyMaterialTheme(material: THREE.MeshStandardMaterial, theme: SceneTheme) {
  const isDark = theme === 'dark'
  const name = material.name.toLowerCase()

  if (shouldPreserveLaptopMaterial(material)) {
    return
  }

  if (!isDark && name === 'laptopsurface.002') {
    return
  }

  if (name.includes('screen')) {
    material.emissive = new THREE.Color(isDark ? '#dfffe8' : '#fff7df')
    material.emissiveIntensity = isDark ? 1.75 : 0.78
    material.roughness = isDark ? 0.34 : 0.48
    material.metalness = 0
  } else if (name.includes('laptopsurface') || name.includes('painted') || name.includes('logo')) {
    material.color = new THREE.Color(isDark ? '#151d1b' : '#d7ded2')
    material.metalness = isDark ? 0.72 : 0.42
    material.roughness = isDark ? 0.32 : 0.46
    material.envMapIntensity = isDark ? 0.72 : 0.55
  } else if (name.includes('surfacemetal')) {
    material.color = new THREE.Color(isDark ? '#111a1a' : '#c9d4cc')
    material.metalness = isDark ? 0.82 : 0.52
    material.roughness = isDark ? 0.3 : 0.42
    material.envMapIntensity = isDark ? 0.78 : 0.58
  } else if (name.includes('interiorblack')) {
    material.color = new THREE.Color(isDark ? '#070b0c' : '#323c38')
    material.metalness = isDark ? 0.56 : 0.34
    material.roughness = isDark ? 0.52 : 0.58
    material.envMapIntensity = isDark ? 0.64 : 0.5
  } else if (name.includes('keyboard')) {
    material.color = new THREE.Color(isDark ? '#ffffff' : '#f7f3e7')
    material.emissive = new THREE.Color(isDark ? '#dfffe8' : '#fff3d2')
    material.emissiveIntensity = isDark ? 0.42 : 0.16
    material.metalness = 0
    material.roughness = isDark ? 0.3 : 0.4
  } else if (name.includes('indicatorlights')) {
    material.emissive = new THREE.Color(isDark ? '#9cffc2' : '#35a464')
    material.emissiveIntensity = isDark ? 1.25 : 0.55
  }

  material.needsUpdate = true
}

function shouldPreserveLaptopMaterial(material: THREE.MeshStandardMaterial) {
  const name = material.name.toLowerCase()
  return (
    name.includes('laser') ||
    name.includes('iridescent') ||
    name.includes('镭射') ||
    name.includes('logo') ||
    Boolean(material.map && !name.includes('keyboard') && !name.includes('screen'))
  )
}

function smootherstep(value: number) {
  return value * value * value * (value * (value * 6 - 15) + 10)
}
