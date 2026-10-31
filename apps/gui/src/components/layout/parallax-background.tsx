import * as React from "react"
import { cn } from "@/lib/utils"
import factorioBgUrl from "@/assets/factorio_bg.jpg"

interface ParallaxBackgroundProps {
  className?: string
  /** Maximum offset in pixels for parallax movement. Defaults to 20px */
  maxOffset?: number
}

export function ParallaxBackground({
  className,
  maxOffset = 20,
}: ParallaxBackgroundProps) {
  const bgRef = React.useRef<HTMLDivElement>(null)
  const targetX = React.useRef(0)
  const targetY = React.useRef(0)
  const currentX = React.useRef(0)
  const currentY = React.useRef(0)
  const isAnimating = React.useRef(false)
  const rafId = React.useRef<number | null>(null)

  React.useEffect(() => {
    // Respect user's OS preference for reduced motion
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (prefersReducedMotion) return

    const updatePosition = () => {
      // Smooth linear interpolation (lerp) for physics-based momentum
      currentX.current += (targetX.current - currentX.current) * 0.08
      currentY.current += (targetY.current - currentY.current) * 0.08

      if (bgRef.current) {
        bgRef.current.style.transform = `translate3d(${currentX.current.toFixed(2)}px, ${currentY.current.toFixed(2)}px, 0)`
      }

      // Check if settled close enough to target
      const diffX = Math.abs(targetX.current - currentX.current)
      const diffY = Math.abs(targetY.current - currentY.current)

      if (diffX > 0.02 || diffY > 0.02) {
        rafId.current = requestAnimationFrame(updatePosition)
      } else {
        isAnimating.current = false
      }
    }

    const startAnimation = () => {
      if (!isAnimating.current) {
        isAnimating.current = true
        rafId.current = requestAnimationFrame(updatePosition)
      }
    }

    const handlePointerMove = (e: PointerEvent) => {
      // Calculate normalized mouse coordinate relative to window (-1 to +1)
      const normX = (e.clientX / window.innerWidth - 0.5) * 2
      const normY = (e.clientY / window.innerHeight - 0.5) * 2

      // Opposite direction creates natural floating depth
      targetX.current = -normX * maxOffset
      targetY.current = -normY * maxOffset

      startAnimation()
    }

    const handleMouseLeave = () => {
      // Smoothly return to center position
      targetX.current = 0
      targetY.current = 0
      startAnimation()
    }

    window.addEventListener("pointermove", handlePointerMove, { passive: true })
    document.addEventListener("mouseleave", handleMouseLeave)

    return () => {
      window.removeEventListener("pointermove", handlePointerMove)
      document.removeEventListener("mouseleave", handleMouseLeave)
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current)
      }
    }
  }, [maxOffset])

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 z-0 overflow-hidden select-none",
        className
      )}
      aria-hidden="true"
    >
      {/* Moving parallax background layer */}
      <div
        ref={bgRef}
        className="absolute -inset-8 bg-repeat opacity-[0.14] dark:opacity-[0.24] dark:brightness-[0.82] dark:contrast-[1.08] will-change-transform"
        style={{
          backgroundImage: `url(${factorioBgUrl})`,
          backgroundSize: "1920px auto",
          backgroundPosition: "center top",
          maskImage: "radial-gradient(ellipse 98% 95% at 50% 50%, black 70%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 98% 95% at 50% 50%, black 70%, transparent 100%)",
        }}
      />
    </div>
  )
}

