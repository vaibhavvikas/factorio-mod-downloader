import * as React from "react"
import { Settings2, ThumbsUp, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useModQueueStore } from "@/stores/use-mod-queue-store"

export function QueueSettingsPopover() {
  const autoIncludeRecommended = useModQueueStore(
    (s) => s.autoIncludeRecommended
  )
  const setAutoIncludeRecommended = useModQueueStore(
    (s) => s.setAutoIncludeRecommended
  )
  const autoIncludeOptional = useModQueueStore((s) => s.autoIncludeOptional)
  const setAutoIncludeOptional = useModQueueStore(
    (s) => s.setAutoIncludeOptional
  )

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs font-medium cursor-pointer"
          >
            <Settings2 className="size-3.5 text-muted-foreground" />
            <span>Dependencies</span>
          </Button>
        }
      />
      <PopoverContent className="w-80 p-4 space-y-4" align="end">
        <div className="space-y-1">
          <h4 className="text-xs font-semibold text-foreground">
            Auto-Include Rules
          </h4>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Choose which sub-dependencies are automatically checked when new mods
            are added to your queue.
          </p>
        </div>

        <div className="space-y-3 pt-1 border-t border-border/60">
          {/* Recommended Dependencies Toggle */}
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <ThumbsUp className="size-3 text-amber-500" />
                <span className="text-xs font-medium text-foreground">
                  Recommended
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Author-suggested companion mods
              </p>
            </div>
            <Switch
              checked={autoIncludeRecommended}
              onCheckedChange={setAutoIncludeRecommended}
            />
          </div>

          {/* Optional Dependencies Toggle */}
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <Sparkles className="size-3 text-blue-500" />
                <span className="text-xs font-medium text-foreground">
                  Optional
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Optional integrations and cosmetic extras
              </p>
            </div>
            <Switch
              checked={autoIncludeOptional}
              onCheckedChange={setAutoIncludeOptional}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
