import { Canvas, useFrame } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

RectAreaLightUniformsLib.init()

type LaptopSceneProps = {
  dragRotation: { x: number; y: number }
  scrollProgress: number
}

type PointerState = {
  dragging: boolean
  lastX: number
  lastY: number
}

export function KaliLaptopShowcase() {
  const sceneRef = useRef<HTMLDivElement | null>(null)
  const pointerRef = useRef<PointerState>({ dragging: false, lastX: 0, lastY: 0 })
  const [dragRotation, setDragRotation] = useState({ x: 0, y: 0 })
  const [scrollProgress, setScrollProgress] = useState(0)

  useEffect(() => {
    let frame = 0

    const update = () => {
      frame = 0
      const element = sceneRef.current
      if (!element) return

      const rect = element.getBoundingClientRect()
      const viewport = window.innerHeight || 1
      const progress = 1 - (rect.top + rect.height * 0.18) / (viewport + rect.height * 0.46)
      setScrollProgress(THREE.MathUtils.clamp(progress, 0, 1))
    }

    const requestUpdate = () => {
      if (frame) return
      frame = window.requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', requestUpdate, { passive: true })
    window.addEventListener('resize', requestUpdate)

    return () => {
      window.removeEventListener('scroll', requestUpdate)
      window.removeEventListener('resize', requestUpdate)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <div className="relative z-[80] mx-auto h-[620px] max-w-7xl overflow-visible md:h-[760px]" ref={sceneRef}>
      <div
        aria-label="ROG 笔记本电脑 3D 模型展示，可拖动查看"
        className="absolute -inset-x-20 -inset-y-24 z-[90] cursor-grab touch-none select-none active:cursor-grabbing md:-inset-x-36 md:-inset-y-32"
        onPointerCancel={stopDragging}
        onPointerDown={(event) => {
          pointerRef.current = { dragging: true, lastX: event.clientX, lastY: event.clientY }
          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerLeave={stopDragging}
        onPointerMove={(event) => {
          const pointer = pointerRef.current
          if (!pointer.dragging) return

          const deltaX = event.clientX - pointer.lastX
          const deltaY = event.clientY - pointer.lastY
          pointerRef.current = { dragging: true, lastX: event.clientX, lastY: event.clientY }
          setDragRotation((current) => ({
            x: current.x - deltaY * 0.16,
            y: current.y + deltaX * 0.18,
          }))
        }}
        onPointerUp={stopDragging}
      >
        <Canvas
          camera={{ fov: 28, position: [0, 1.18, 9.4] }}
          className="h-full w-full"
          dpr={[1, 1.75]}
          gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
        >
          <ambientLight intensity={0.72} />
          <hemisphereLight args={['#ffffff', '#3a352e', 0.7]} />
          <FrontSoftboxLight />
          <WarmRimLight />

          <LaptopScene dragRotation={dragRotation} scrollProgress={scrollProgress} />
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

function FrontSoftboxLight() {
  const lightRef = useRef<THREE.RectAreaLight | null>(null)

  useEffect(() => {
    lightRef.current?.lookAt(0, 0.2, 0)
  }, [])

  return <rectAreaLight ref={lightRef} color="#ffffff" height={4.2} intensity={5.6} position={[0, 4.2, 5.2]} width={6.8} />
}

function WarmRimLight() {
  const lightRef = useRef<THREE.DirectionalLight | null>(null)

  useEffect(() => {
    lightRef.current?.target.position.set(0, 0.35, 0)
    lightRef.current?.target.updateMatrixWorld()
  }, [])

  return (
    <>
      <directionalLight ref={lightRef} color="#ffd2a3" intensity={1.45} position={[-3.6, 2.9, -4.8]} />
      <directionalLight color="#fff7ee" intensity={0.42} position={[3.4, 2.4, -3.2]} />
    </>
  )
}

function LaptopScene({ dragRotation, scrollProgress }: LaptopSceneProps) {
  const groupRef = useRef<THREE.Group | null>(null)
  const [model, setModel] = useState<THREE.Group | null>(null)

  useEffect(() => {
    let cancelled = false
    const loader = new GLTFLoader()

    loader.load(
      '/models/幻14笔记本电脑.glb',
      (gltf) => {
        if (cancelled) return
        const normalized = normalizeLaptopModel(gltf.scene)
        setModel(normalized)
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

  useFrame(() => {
    const group = groupRef.current
    if (!group) return

    const elapsed = performance.now() * 0.001
    const easedScroll = smoothstep(scrollProgress)
    const idleBreath = Math.sin(elapsed * 0.78) * 0.016

    group.position.y = THREE.MathUtils.lerp(group.position.y, 0.08 + Math.sin(easedScroll * Math.PI) * 0.14 + idleBreath, 0.075)
    group.position.z = THREE.MathUtils.lerp(group.position.z, THREE.MathUtils.lerp(0.18, -0.12, easedScroll), 0.075)
    group.rotation.x = THREE.MathUtils.lerp(group.rotation.x, THREE.MathUtils.degToRad(-3 + easedScroll * -2.5 + dragRotation.x), 0.075)
    group.rotation.y = THREE.MathUtils.lerp(group.rotation.y, THREE.MathUtils.degToRad(-16 + easedScroll * 28 + dragRotation.y), 0.075)
    group.rotation.z = THREE.MathUtils.lerp(group.rotation.z, THREE.MathUtils.degToRad(-0.8 + easedScroll * 1.8), 0.075)
    group.scale.setScalar(THREE.MathUtils.lerp(group.scale.x, 1 + Math.sin(easedScroll * Math.PI) * 0.035, 0.06))
  })

  return (
    <group ref={groupRef}>
      {model ? <primitive object={model} /> : <ModelLoadingFallback />}
    </group>
  )
}

function normalizeLaptopModel(source: THREE.Group) {
  const model = source.clone(true)
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

  return model
}

function ModelLoadingFallback() {
  return (
    <group>
      <mesh position={[0, -0.18, 0]}>
        <boxGeometry args={[3.6, 0.12, 2.35]} />
        <meshStandardMaterial color="#26312b" metalness={0.45} roughness={0.42} />
      </mesh>
      <mesh position={[0, 0.82, -1.05]} rotation={[THREE.MathUtils.degToRad(-8), 0, 0]}>
        <boxGeometry args={[3.5, 2.2, 0.08]} />
        <meshStandardMaterial color="#0a0f0c" metalness={0.42} roughness={0.4} />
      </mesh>
    </group>
  )
}

function smoothstep(value: number) {
  return value * value * (3 - 2 * value)
}
