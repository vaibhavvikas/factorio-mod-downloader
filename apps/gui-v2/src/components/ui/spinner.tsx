import * as React from "react"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

export function Spinner({
  className,
  ...props
}: React.ComponentProps<typeof Loader2>) {
  return (
    <Loader2
      data-icon="inline-start"
      className={cn("animate-spin", className)}
      {...props}
    />
  )
}
