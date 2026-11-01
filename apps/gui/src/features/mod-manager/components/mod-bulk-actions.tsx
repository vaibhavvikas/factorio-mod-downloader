import * as React from "react"
import { CheckSquare, Square, Trash2, Power, PowerOff, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useModManagerStore } from "@/stores/use-mod-manager-store"

interface ModBulkActionsProps {
  filteredModNames: string[]
  onUninstallSelected: (names: string[]) => void
}

export function ModBulkActions({
  filteredModNames,
  onUninstallSelected,
}: ModBulkActionsProps) {
  const selectedMods = useModManagerStore((s) => s.selectedMods)
  const selectAllFiltered = useModManagerStore((s) => s.selectAllFiltered)
  const clearSelection = useModManagerStore((s) => s.clearSelection)
  const batchToggleSelected = useModManagerStore((s) => s.batchToggleSelected)
  const isFactorioRunning = useModManagerStore((s) => s.isFactorioRunning)

  const selectedCount = selectedMods.size
  const allSelected = filteredModNames.length > 0 && filteredModNames.every((n) => selectedMods.has(n))

  if (selectedCount === 0) return null

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg border border-primary/30 bg-primary/5 text-xs animate-in fade-in duration-150">
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs gap-1.5 cursor-pointer font-medium"
          onClick={() => {
            if (allSelected) {
              clearSelection()
            } else {
              selectAllFiltered(filteredModNames)
            }
          }}
        >
          {allSelected ? <CheckSquare className="size-3.5 text-primary" /> : <Square className="size-3.5" />}
          <span>{allSelected ? "Deselect All" : "Select All Filtered"}</span>
        </Button>
        <span className="font-semibold text-primary">
          {selectedCount} mod{selectedCount > 1 ? "s" : ""} selected
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs gap-1 cursor-pointer"
          onClick={() => batchToggleSelected(true)}
          aria-label="Enable Selected Mods"
        >
          <Power className="size-3 text-emerald-500" />
          <span>Enable</span>
        </Button>

        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs gap-1 cursor-pointer"
          onClick={() => batchToggleSelected(false)}
          aria-label="Disable Selected Mods"
        >
          <PowerOff className="size-3 text-amber-500" />
          <span>Disable</span>
        </Button>

        <Button
          size="sm"
          variant="destructive"
          className="h-7 px-2 text-xs gap-1 cursor-pointer"
          disabled={isFactorioRunning}
          onClick={() => onUninstallSelected(Array.from(selectedMods))}
          aria-label="Uninstall Selected Mods"
        >
          <Trash2 className="size-3" />
          <span>Uninstall</span>
        </Button>

        <Button
          size="icon"
          variant="ghost"
          className="size-7 text-muted-foreground cursor-pointer"
          onClick={clearSelection}
          aria-label="Clear Selection"
        >
          <X className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}
