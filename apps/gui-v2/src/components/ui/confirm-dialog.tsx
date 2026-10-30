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

export interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: React.ReactNode
  confirmText?: string
  cancelText?: string
  variant?: "destructive" | "default"
  onConfirm: () => void | Promise<void>
  isProcessing?: boolean
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = "Delete",
  cancelText = "Cancel",
  variant = "destructive",
  onConfirm,
  isProcessing = false,
}: ConfirmDialogProps) {
  const [internalLoading, setInternalLoading] = React.useState(false)

  const handleConfirm = async () => {
    try {
      setInternalLoading(true)
      await onConfirm()
      onOpenChange(false)
    } finally {
      setInternalLoading(false)
    }
  }

  const busy = isProcessing || internalLoading

  return (
    <Dialog open={open} onOpenChange={(val) => !busy && onOpenChange(val)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && (
            <DialogDescription>
              {description}
            </DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
            aria-label={cancelText}
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            variant={variant}
            onClick={handleConfirm}
            disabled={busy}
            aria-label={confirmText}
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
