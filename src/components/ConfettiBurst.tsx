'use client'

import { useEffect, useRef } from 'react'

const COLORS = ['#f9a8d4', '#fcd34d', '#86efac', '#93c5fd', '#c4b5fd', '#fda4af', '#fb7185']

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
  rot: number
  vr: number
}

type ConfettiBurstProps = {
  active: boolean
  durationMs?: number
}

export function ConfettiBurst({ active, durationMs = 3000 }: ConfettiBurstProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!active) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const particles: Particle[] = Array.from({ length: 110 }, () => ({
      x: Math.random() * canvas.width,
      y: -16 - Math.random() * canvas.height * 0.4,
      vx: (Math.random() - 0.5) * 5,
      vy: 2.5 + Math.random() * 4,
      size: 5 + Math.random() * 5,
      color: COLORS[Math.floor(Math.random() * COLORS.length)]!,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.25,
    }))

    const start = performance.now()
    let raf = 0

    const draw = (now: number) => {
      const elapsed = now - start
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      for (const p of particles) {
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.06
        p.rot += p.vr
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size * 0.55)
        ctx.restore()
      }

      if (elapsed < durationMs) {
        raf = requestAnimationFrame(draw)
      }
    }

    raf = requestAnimationFrame(draw)

    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(raf)
    }
  }, [active, durationMs])

  if (!active) return null

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-[96]"
      aria-hidden
    />
  )
}
