import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Gamepad2, ArrowRight, ArrowLeft, RefreshCw } from "lucide-react"

export interface FactorioVersionConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  fromVersion: string | null
  toVersion: string
  onConfirm: () => void | Promise<void>
  isProcessing?: boolean
}

export function FactorioVersionConfirmDialog({
  open,
  onOpenChange,
  fromVersion,
  toVersion,
  onConfirm,
  isProcessing = false,
}: FactorioVersionConfirmDialogProps) {
  const isDowngrade =
    fromVersion &&
    toVersion !== "any" &&
    fromVersion !== "any" &&
    compareSemVer(toVersion, fromVersion) < 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gamepad2 className="size-4 text-primary" />
            <span>Confirm Factorio Version Change</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
            Changing the target Factorio version from{" "}
            <span className="font-mono font-semibold">
              {fromVersion || "Any"}
            </span>{" "}
            to{" "}
            <span className="font-mono font-semibold">{toVersion === "any" ? "Any" : `v${toVersion}`}</span>
            {". "}
            {isDowngrade
              ? "This is a downgrade. Mods incompatible with this version will be flagged, and you may see downgrade options for installed mods."
              : toVersion === "any"
                ? "You will no longer filter mods by Factorio version."
                : `Mods incompatible with v${toVersion} will be flagged, and compatible updates will be highlighted.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
            aria-label="Cancel version change"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={onConfirm}
            disabled={isProcessing}
            aria-label="Confirm version change"
          >
            {isProcessing ? <RefreshCw className="size-3.5 mr-2 animate-spin" /> : <ArrowRight className="size-3.5 mr-2" />}
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Simple semver comparison for display purposes
function compareSemVer(a: string, b: string): number {
  const cleanA = a.replace(/^v/, "").split(".").map((s) => parseInt(s, 10) || 0)
  const cleanB = b.replace(/^v/, "").split(".").map((s) => parseInt(s, 10) || 0)
  const len = Math.max(cleanA.length, cleanB.length)
  for (let i = 0; i < len; i++) {
    const pa = cleanA[i] || 0
    const pb = cleanB[i] || 0
    if (pa < pb) return -1
    if (pa > pb) return 1
  }
  return 0
}
