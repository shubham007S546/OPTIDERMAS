'use client'

import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'

type NeuralState = 'idle' | 'active' | 'complete'

function usePrefersReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mediaQuery.matches)
    const listener = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mediaQuery.addEventListener('change', listener)
    return () => mediaQuery.removeEventListener('change', listener)
  }, [])
  return reducedMotion
}

/**
 * Optimized GPU-batched 3D Neural Brain Mesh.
 * Uses InstancedMesh (2 draw calls) + merged LineSegments (2 draw calls) instead of
 * 450 individual React components & per-frame callbacks, keeping CPU/GPU ultra-fast.
 */
function BrainMesh({ state, reducedMotion }: { state: NeuralState; reducedMotion: boolean }) {
  const group = useRef<THREE.Group>(null)
  const regularNodesRef = useRef<THREE.InstancedMesh>(null)
  const litNodesRef = useRef<THREE.InstancedMesh>(null)
  const activeLinesMatRef = useRef<THREE.LineBasicMaterial>(null)

  const { regularNodes, litNodes, inactiveLineGeo, activeLineGeo } = useMemo(() => {
    const points: THREE.Vector3[] = []
    for (let index = 0; index < 150; index += 1) {
      const side = index % 2 === 0 ? -1 : 1
      const t = (index / 150) * Math.PI * 2
      const x = side * (0.18 + Math.cos(t * 3.1) * 0.34 + Math.sin(index * 1.91) * 0.32)
      const y = Math.sin(t * 1.75) * 0.54 + Math.cos(index * 1.37) * 0.22
      const z = (Math.sin(index * 2.17) * 0.5 + 0.5) * 0.5 - 0.25 + Math.cos(t * 2.4) * 0.24
      if ((x * x) / 0.74 + (y * y) / 0.7 + (z * z) / 0.42 < 1) {
        points.push(new THREE.Vector3(x, y, z))
      }
    }

    const reg: { pos: THREE.Vector3; idx: number }[] = []
    const lit: { pos: THREE.Vector3; idx: number }[] = []
    points.forEach((p, idx) => {
      if (idx % 4 === 0) lit.push({ pos: p, idx })
      else reg.push({ pos: p, idx })
    })

    const inactivePositions: number[] = []
    const activePositions: number[] = []
    let edgeIdx = 0
    for (let i = 0; i < points.length; i++) {
      const node = points[i]
      let added = 0
      for (let j = i + 1; j < Math.min(i + 8, points.length) && added < 3; j++) {
        const target = points[j]
        if (node.distanceTo(target) < 0.48) {
          const dest = edgeIdx % 3 === 0 ? activePositions : inactivePositions
          dest.push(node.x, node.y, node.z, target.x, target.y, target.z)
          edgeIdx++
          added++
        }
      }
    }

    const inGeo = new THREE.BufferGeometry()
    inGeo.setAttribute('position', new THREE.Float32BufferAttribute(inactivePositions, 3))

    const actGeo = new THREE.BufferGeometry()
    actGeo.setAttribute('position', new THREE.Float32BufferAttribute(activePositions, 3))

    return { regularNodes: reg, litNodes: lit, inactiveLineGeo: inGeo, activeLineGeo: actGeo }
  }, [])

  // Dispose geometries safely on unmount
  useEffect(() => {
    return () => {
      inactiveLineGeo.dispose()
      activeLineGeo.dispose()
    }
  }, [inactiveLineGeo, activeLineGeo])

  const dummy = useMemo(() => new THREE.Object3D(), [])
  const active = state === 'active'

  // Initialize static transforms once when state/reducedMotion changes
  useEffect(() => {
    if (regularNodesRef.current) {
      regularNodes.forEach(({ pos }, idx) => {
        dummy.position.copy(pos)
        dummy.scale.setScalar(1)
        dummy.updateMatrix()
        regularNodesRef.current!.setMatrixAt(idx, dummy.matrix)
      })
      regularNodesRef.current.instanceMatrix.needsUpdate = true
    }
    if (litNodesRef.current) {
      litNodes.forEach(({ pos }, idx) => {
        dummy.position.copy(pos)
        dummy.scale.setScalar(active ? 1.45 : 1.0)
        dummy.updateMatrix()
        litNodesRef.current!.setMatrixAt(idx, dummy.matrix)
      })
      litNodesRef.current.instanceMatrix.needsUpdate = true
    }
  }, [regularNodes, litNodes, dummy, active])

  // Single lightweight animation callback instead of 150+ per-frame listeners
  useFrame(({ clock }, delta) => {
    if (reducedMotion || !group.current) return
    const time = clock.getElapsedTime()
    group.current.rotation.y += delta * (active ? 0.24 : 0.075)
    group.current.rotation.x = Math.sin(time * 0.42) * 0.045
    group.current.position.y = Math.sin(time * 1.15) * 0.035

    if (litNodesRef.current) {
      const baseScale = active ? 1.45 : 1.0
      const amp = active ? 0.28 : 0.08
      litNodes.forEach(({ pos, idx }, i) => {
        const pulse = baseScale + Math.sin(time * 2.4 + idx * 0.7) * amp
        dummy.position.copy(pos)
        dummy.scale.setScalar(pulse)
        dummy.updateMatrix()
        litNodesRef.current!.setMatrixAt(i, dummy.matrix)
      })
      litNodesRef.current.instanceMatrix.needsUpdate = true
    }

    if (activeLinesMatRef.current && active) {
      activeLinesMatRef.current.opacity = 0.65 + Math.sin(time * 2.2) * 0.22
    }
  })

  return (
    <group ref={group} scale={1.34}>
      <mesh position={[-0.34, 0, 0]} scale={[0.94, 1.03, 0.88]}>
        <sphereGeometry args={[0.82, 24, 18]} />
        <meshBasicMaterial color="#78aeba" transparent opacity={0.08} wireframe />
      </mesh>
      <mesh position={[0.34, 0, 0]} scale={[0.94, 1.03, 0.88]}>
        <sphereGeometry args={[0.82, 24, 18]} />
        <meshBasicMaterial color="#56d5e4" transparent opacity={0.1} wireframe />
      </mesh>

      <lineSegments geometry={inactiveLineGeo}>
        <lineBasicMaterial color="#2b8795" transparent opacity={0.26} />
      </lineSegments>

      <lineSegments geometry={activeLineGeo}>
        <lineBasicMaterial
          ref={activeLinesMatRef}
          color={active ? '#d8fbff' : '#2b8795'}
          transparent
          opacity={active ? 0.82 : 0.26}
        />
      </lineSegments>

      <instancedMesh ref={regularNodesRef} args={[undefined, undefined, regularNodes.length]}>
        <sphereGeometry args={[0.025, 8, 8]} />
        <meshBasicMaterial color="#67d9e7" transparent opacity={0.72} />
      </instancedMesh>

      <instancedMesh ref={litNodesRef} args={[undefined, undefined, litNodes.length]}>
        <sphereGeometry args={[0.026, 8, 8]} />
        <meshBasicMaterial color={active ? '#e6feff' : '#67d9e7'} transparent opacity={active ? 0.98 : 0.72} />
      </instancedMesh>
    </group>
  )
}

export function NeuralBrain({
  state = 'idle',
  className = '',
}: {
  state?: NeuralState
  className?: string
}) {
  const reducedMotion = usePrefersReducedMotion()
  return (
    <div
      className={className}
      aria-label="3D visualization of the OptiDerma neural brain inference model"
      role="img"
    >
      <Canvas
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        frameloop={reducedMotion ? 'demand' : 'always'}
      >
        <PerspectiveCamera makeDefault position={[0, 0, 3.7]} />
        <ambientLight intensity={0.7} />
        <BrainMesh state={state} reducedMotion={reducedMotion} />
        <OrbitControls enablePan={false} enableZoom={false} minDistance={2.7} maxDistance={5} autoRotate={false} />
      </Canvas>
    </div>
  )
}
