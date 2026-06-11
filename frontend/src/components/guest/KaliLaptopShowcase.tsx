import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

RectAreaLightUniformsLib.init()

const MODEL_VERTICAL_OFFSET = -0.3
const LID_OPEN_DEGREES = -108
const LID_ANIMATION_SECONDS = 1.05

type SceneTheme = 'dark' | 'light'

type LaptopSceneProps = {
  baseCanvasHeight: number
  dragRotation: { x: number; y: number }
  lidOpen: boolean
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

type CanvasBounds = {
  baseHeight: number
  bottom: number
  top: number
}

export function KaliLaptopShowcase() {
  const sceneRef = useRef<HTMLDivElement | null>(null)
  const pointerRef = useRef<PointerState>({ dragging: false, lastX: 0, lastY: 0, travel: 0 })
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
          stopDragging(event)
          if (wasClick) setLidOpen((current) => !current)
        }}
        style={{ bottom: -canvasBounds.bottom, top: -canvasBounds.top }}
      >
        <Canvas
          camera={{ fov: 28, position: [0, 1.18, 9.4] }}
          className="h-full w-full"
          dpr={[1, 1.75]}
          gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
        >
          <ambientLight intensity={theme === 'dark' ? 0.72 : 0.92} />
          <hemisphereLight
            args={theme === 'dark' ? ['#ffffff', '#3a352e', 0.7] : ['#fff8ec', '#d8e5d4', 0.92]}
          />
          <FrontSoftboxLight theme={theme} />
          <WarmRimLight theme={theme} />

          <LaptopScene
            baseCanvasHeight={canvasBounds.baseHeight}
            dragRotation={dragRotation}
            lidOpen={lidOpen}
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

function FrontSoftboxLight({ theme }: { theme: SceneTheme }) {
  const lightRef = useRef<THREE.RectAreaLight | null>(null)

  useEffect(() => {
    lightRef.current?.lookAt(0, 0.2, 0)
  }, [])

  return (
    <rectAreaLight
      ref={lightRef}
      color={theme === 'dark' ? '#ffffff' : '#fff2dc'}
      height={4.2}
      intensity={theme === 'dark' ? 5.6 : 4.2}
      position={[0, 4.2, 5.2]}
      width={6.8}
    />
  )
}

function WarmRimLight({ theme }: { theme: SceneTheme }) {
  const lightRef = useRef<THREE.DirectionalLight | null>(null)

  useEffect(() => {
    lightRef.current?.target.position.set(0, 0.35, 0)
    lightRef.current?.target.updateMatrixWorld()
  }, [])

  return (
    <>
      <directionalLight
        ref={lightRef}
        color={theme === 'dark' ? '#ffd2a3' : '#b8e8c2'}
        intensity={theme === 'dark' ? 1.45 : 1.05}
        position={[-3.6, 2.9, -4.8]}
      />
      <directionalLight
        color={theme === 'dark' ? '#fff7ee' : '#ffffff'}
        intensity={theme === 'dark' ? 0.42 : 0.62}
        position={[3.4, 2.4, -3.2]}
      />
    </>
  )
}

function LaptopScene({ baseCanvasHeight, dragRotation, lidOpen, theme }: LaptopSceneProps) {
  const groupRef = useRef<THREE.Group | null>(null)
  const lidRef = useRef<THREE.Object3D | null>(null)
  const lidAnimationRef = useRef<LidAnimation>({ from: 0, startedAt: 0, to: 0 })
  const lidProgressRef = useRef(0)
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
    const loader = new GLTFLoader()

    loader.load(
      '/models/幻14笔记本电脑.glb',
      (gltf) => {
        if (cancelled) return
        const normalized = normalizeLaptopModel(gltf.scene)
        lidRef.current = normalized.lid
        setModel(normalized.root)
      },
      undefined,
      (error) => {
        console.error('Failed to load ROG laptop model:', error)
      },
    )

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!model) return
    applyLaptopTheme(model, theme)
  }, [model, theme])

  useFrame(() => {
    const group = groupRef.current
    if (!group) return

    const elapsed = performance.now() * 0.001
    const idleBreath = Math.sin(elapsed * 0.78) * 0.016
    const scaleCompensation = viewportSize.height > 0 ? baseCanvasHeight / viewportSize.height : 1

    group.position.y = THREE.MathUtils.lerp(
      group.position.y,
      MODEL_VERTICAL_OFFSET + 0.08 + idleBreath,
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
      const elapsedSinceToggle = elapsed - animation.startedAt
      const rawProgress = THREE.MathUtils.clamp(elapsedSinceToggle / LID_ANIMATION_SECONDS, 0, 1)
      const easedProgress = smootherstep(rawProgress)
      const lidProgress = THREE.MathUtils.lerp(animation.from, animation.to, easedProgress)
      const idleLidMotion = lidProgress > 0.96 ? Math.sin(elapsed * 0.92) * 0.012 : 0
      lidProgressRef.current = lidProgress
      lid.rotation.x = THREE.MathUtils.degToRad(LID_OPEN_DEGREES * lidProgress) + idleLidMotion
    }
  })

  return (
    <group ref={groupRef}>
      {model && <primitive object={model} />}
    </group>
  )
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

function smootherstep(value: number) {
  return value * value * value * (value * (value * 6 - 15) + 10)
}
