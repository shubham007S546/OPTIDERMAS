'use client'

import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'

type NeuralState = 'idle' | 'active' | 'complete'

function BrainNode({ position, index, active }: { position: THREE.Vector3; index: number; active: boolean }) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (!ref.current) return
    const pulse = 1 + Math.sin(clock.getElapsedTime() * 2.4 + index * 0.7) * (active ? 0.22 : 0.08)
    ref.current.scale.setScalar(pulse)
  })
  const lit = active && index % 4 === 0
  return <mesh ref={ref} position={position}><sphereGeometry args={[lit ? 0.038 : 0.025, 8, 8]} /><meshBasicMaterial color={lit ? '#e6feff' : '#67d9e7'} transparent opacity={lit ? 0.98 : 0.72} /></mesh>
}

function BrainMesh({ state }: { state: NeuralState }) {
  const group = useRef<THREE.Group>(null)
  const nodes = useMemo(() => {
    const points: THREE.Vector3[] = []
    for (let index = 0; index < 150; index += 1) {
      const side = index % 2 === 0 ? -1 : 1
      const t = (index / 150) * Math.PI * 2
      const x = side * (0.18 + Math.cos(t * 3.1) * 0.34 + Math.sin(index * 1.91) * 0.32)
      const y = Math.sin(t * 1.75) * 0.54 + Math.cos(index * 1.37) * 0.22
      const z = (Math.sin(index * 2.17) * 0.5 + 0.5) * 0.5 - 0.25 + Math.cos(t * 2.4) * 0.24
      if (x * x / 0.74 + y * y / 0.7 + z * z / 0.42 < 1) points.push(new THREE.Vector3(x, y, z))
    }
    return points
  }, [])
  const edges = useMemo(() => nodes.flatMap((node, index) => nodes.slice(index + 1, index + 8).filter((target) => node.distanceTo(target) < 0.48).slice(0, 3).map((target) => [node, target] as const)), [nodes])
  useFrame(({ clock }, delta) => {
    if (!group.current) return
    const time = clock.getElapsedTime()
    group.current.rotation.y += delta * (state === 'active' ? 0.24 : 0.075)
    group.current.rotation.x = Math.sin(time * 0.42) * 0.045
    group.current.position.y = Math.sin(time * 1.15) * 0.035
  })
  const active = state === 'active'
  return <group ref={group} scale={1.34}>
    <mesh position={[-0.34, 0, 0]} scale={[0.94, 1.03, 0.88]}><sphereGeometry args={[0.82, 32, 22]} /><meshBasicMaterial color="#78aeba" transparent opacity={0.08} wireframe /></mesh>
    <mesh position={[0.34, 0, 0]} scale={[0.94, 1.03, 0.88]}><sphereGeometry args={[0.82, 32, 22]} /><meshBasicMaterial color="#56d5e4" transparent opacity={0.1} wireframe /></mesh>
    <mesh position={[0, 0, 0.8]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.58, 0.012, 8, 80]} /><meshBasicMaterial color="#8cecf1" transparent opacity={0.17} /></mesh>
    {edges.map(([from, to], index) => <Line key={index} from={from} to={to} active={active && index % 3 === 0} />)}
    {nodes.map((node, index) => <BrainNode key={index} position={node} index={index} active={active} />)}
  </group>
}

function Line({ from, to, active }: { from: THREE.Vector3; to: THREE.Vector3; active: boolean }) {
  const geometry = useMemo(() => { const next = new THREE.BufferGeometry(); next.setFromPoints([from, to]); return next }, [from, to])
  return <primitive object={new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: active ? '#d8fbff' : '#2b8795', transparent: true, opacity: active ? 0.86 : 0.26 }))} />
}

export function NeuralBrain({ state = 'idle', className = '' }: { state?: NeuralState; className?: string }) {
  return <div className={className} aria-label="Animated 3D visualization of the OptiDerma neural brain" role="img"><Canvas dpr={[1, 1.5]} gl={{ antialias: true, alpha: true }}><PerspectiveCamera makeDefault position={[0, 0, 3.7]} /><ambientLight intensity={0.7} /><BrainMesh state={state} /><OrbitControls enablePan={false} minDistance={2.7} maxDistance={5} autoRotate={false} /></Canvas></div>
}
