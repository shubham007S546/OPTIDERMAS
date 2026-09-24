'use client'

import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'

type NeuralState = 'idle' | 'active' | 'complete'

function BrainMesh({ state }: { state: NeuralState }) {
  const group = useRef<THREE.Group>(null)
  const nodes = useMemo(() => Array.from({ length: 74 }, (_, index) => {
    const side = index % 2 === 0 ? -1 : 1
    const t = (index / 74) * Math.PI * 2
    const x = side * (0.18 + Math.sin(t * 2.7) * 0.5 + Math.random() * 0.2)
    const y = Math.cos(t * 1.5) * 0.7 + (Math.random() - 0.5) * 0.45
    const z = Math.sin(t * 1.8) * 0.48 + (Math.random() - 0.5) * 0.38
    return new THREE.Vector3(x, y, z)
  }), [])
  const edges = useMemo(() => nodes.flatMap((node, index) => nodes.slice(index + 1, index + 5).filter((target) => node.distanceTo(target) < 0.72).map((target) => [node, target])), [nodes])
  useFrame(({ clock }, delta) => { if (group.current) { const t = clock.getElapsedTime(); group.current.rotation.y += delta * (state === 'active' ? 0.22 : 0.045); group.current.rotation.x = Math.sin(t * 0.55) * 0.035; group.current.position.y = Math.sin(t * 1.4) * 0.045 } })
  const active = state === 'active'
  return <group ref={group} scale={1.25}>
    <mesh position={[-0.34, 0, 0]} scale={[0.94, 1.04, 0.88]}><sphereGeometry args={[0.82, 28, 18]} /><meshBasicMaterial color="#6f9eae" transparent opacity={0.07} wireframe /></mesh>
    <mesh position={[-0.32, 0, 0]} scale={[0.9, 1, 0.86]}><sphereGeometry args={[0.82, 24, 16]} /><meshBasicMaterial color="#5dd6e8" transparent opacity={0.1} wireframe /></mesh>
    <mesh position={[0.32, 0, 0]} scale={[0.9, 1, 0.86]}><sphereGeometry args={[0.82, 24, 16]} /><meshBasicMaterial color="#5dd6e8" transparent opacity={0.1} wireframe /></mesh>
    {edges.map(([a, b], index) => <Line key={index} from={a} to={b} active={active && index % 3 === 0} />)}
    {nodes.map((node, index) => <mesh key={index} position={node}><sphereGeometry args={[active ? 0.035 : 0.025, 8, 8]} /><meshBasicMaterial color={active && index % 3 === 0 ? '#c8f7ff' : '#5dd6e8'} transparent opacity={active ? 0.92 : 0.68} /></mesh>)}
    <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[1.02, 0.008, 8, 96]} /><meshBasicMaterial color="#72cbd2" transparent opacity={active ? 0.34 : 0.06} /></mesh>
  </group>
}

function Line({ from, to, active }: { from: THREE.Vector3; to: THREE.Vector3; active: boolean }) {
  const ref = useRef<THREE.Line>(null)
  const geometry = useMemo(() => { const g = new THREE.BufferGeometry(); g.setFromPoints([from, to]); return g }, [from, to])
  return <primitive ref={ref} object={new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: active ? '#d8fbff' : '#2b7891', transparent: true, opacity: active ? 0.9 : 0.28 }))} />
}

export function NeuralBrain({ state = 'idle', className = '' }: { state?: NeuralState; className?: string }) {
  return <div className={className} aria-label="Animated visualization of the OptiDerma AI neural processing engine" role="img"><Canvas dpr={[1, 1.5]} gl={{ antialias: true, alpha: true }}><PerspectiveCamera makeDefault position={[0, 0, 3.7]} /><ambientLight intensity={0.7} /><BrainMesh state={state} /><OrbitControls enablePan={false} minDistance={2.7} maxDistance={5} autoRotate={false} /></Canvas></div>
}
