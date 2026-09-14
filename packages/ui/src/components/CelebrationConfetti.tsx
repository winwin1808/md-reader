import React, { useEffect, useRef, useState } from 'react'

export interface CelebrationConfettiProps {
  active?: boolean
  duration?: number
  onComplete?: () => void
  className?: string
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
  rotation: number
  rotationSpeed: number
}

const COLORS = [
  '#f43f5e',
  '#ec4899',
  '#8b5cf6',
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#06b6d4',
]

export function CelebrationConfetti({
  active = false,
  duration = 3000,
  onComplete,
  className,
}: CelebrationConfettiProps): React.JSX.Element | null {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  useEffect(() => {
    if (!active) {
      setIsRunning(false)
      return
    }

    setIsRunning(true)
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }

    const width = window.innerWidth || 800
    const height = window.innerHeight || 600
    canvas.width = width
    canvas.height = height

    // Initialize ~60 confetti particles
    const particleCount = 60
    const particles: Particle[] = []
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * (height * 0.4) - 20,
        vx: (Math.random() - 0.5) * 6,
        vy: Math.random() * 3 + 2,
        size: Math.random() * 6 + 4,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
      })
    }

    let animationFrameId: number
    const gravity = 0.2

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      for (const p of particles) {
        p.x += p.vx
        p.vy += gravity
        p.y += p.vy
        p.rotation += p.rotationSpeed

        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate((p.rotation * Math.PI) / 180)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6)
        ctx.restore()
      }

      animationFrameId = requestAnimationFrame(render)
    }

    animationFrameId = requestAnimationFrame(render)

    const timer = setTimeout(() => {
      cancelAnimationFrame(animationFrameId)
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
      }
      setIsRunning(false)
      onCompleteRef.current?.()
    }, duration)

    return () => {
      cancelAnimationFrame(animationFrameId)
      clearTimeout(timer)
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
      }
    }
  }, [active, duration])

  if (!active && !isRunning) {
    return null
  }

  const classNames = ['celebration-confetti-canvas', className || '']
    .filter(Boolean)
    .join(' ')

  return (
    <canvas
      ref={canvasRef}
      className={classNames}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 99999,
      }}
    />
  )
}
