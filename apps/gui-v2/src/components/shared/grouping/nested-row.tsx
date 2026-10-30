import * as React from "react"
import { cn } from "@/lib/utils"

interface NestedRowProps {
  depth?: number
  ancestorContinues?: boolean[]
  subtitle?: string | null
  isLast?: boolean
  isMissing?: boolean
  className?: string
  children: React.ReactNode
}

const STEP = 32

export function NestedRow({
  depth = 1,
  ancestorContinues = [],
  isLast = false,
  isMissing = false,
  className,
  subtitle,
  children,
}: NestedRowProps) {
  if (depth <= 0) {
    return <div className={cn("w-full", className)}>{children}</div>
  }

  const connectorWidth = depth * STEP
  // Aligns with the middle of the parent checkbox (root checkbox center is at 24px)
  const currentX = 24 + (depth - 1) * STEP
  // Leaves a subtle 4px gap before the checkbox (which starts at connectorWidth + 16px)
  const branchEndX = connectorWidth + 12

  return (
    <div
      className={cn(
        "relative flex items-stretch w-full group/nested transition-colors [&_[data-task-id]]:hover:bg-transparent",
        isMissing
          ? "bg-destructive/10 hover:bg-destructive/15"
          : "hover:bg-muted/40",
        className
      )}
    >
      {/* Left connector column - smooth dotted tree line */}
      <div
        className={cn(
          "relative shrink-0 select-none pointer-events-none z-10",
          isMissing ? "text-destructive/50" : "text-muted-foreground/40"
        )}
        style={{ width: connectorWidth }}
        aria-hidden="true"
      >
        <svg
          className="absolute inset-0 size-full overflow-visible pointer-events-none"
          style={{ width: connectorWidth }}
        >
          {/* Ancestor pass-through lines */}
          {ancestorContinues.map((continues, aIdx) => {
            if (!continues) return null
            const ancX = 24 + aIdx * STEP
            return (
              <line
                key={`anc-${aIdx}`}
                x1={ancX}
                y1="-1"
                x2={ancX}
                y2="100%"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeDasharray="1 3.5"
                strokeLinecap="round"
              />
            )
          })}

          {/* Current level connector line */}
          {isLast ? (
            /* Last sibling at this level: dotted line curves smoothly into horizontal branch */
            <path
              d={`M ${currentX} -1 L ${currentX} 18 Q ${currentX} 26 ${currentX + 8} 26 L ${branchEndX} 26`}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeDasharray="1 3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : (
            <>
              {/* Continuous vertical dotted trunk line from top to bottom */}
              <line
                x1={currentX}
                y1="-1"
                x2={currentX}
                y2="100%"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeDasharray="1 3.5"
                strokeLinecap="round"
              />
              {/* Horizontal branch connecting to this row */}
              <line
                x1={currentX}
                y1="26"
                x2={branchEndX}
                y2="26"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeDasharray="1 3.5"
                strokeLinecap="round"
              />
            </>
          )}
        </svg>
      </div>

      {/* Row content */}
      <div className="flex-1 min-w-0">
        {children}

        {/* Optional fallback subtitle for non-mod rows (e.g. downloads view) */}
        {subtitle && (
          <div className="flex items-center gap-2 pl-3 pt-0.5 pb-1 text-[11px] text-muted-foreground select-none">
            <span className="truncate">{subtitle}</span>
          </div>
        )}
      </div>
    </div>
  )
}

