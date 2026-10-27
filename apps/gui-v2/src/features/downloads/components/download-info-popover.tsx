import * as React from "react"
import { Copy, ExternalLink, Folder, Info, Check } from "lucide-react"
import { invoke } from "@tauri-apps/api/core"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn, openModPortal } from "@/lib/utils"
import type { FormattedDownloadTask } from "../types"

interface DownloadInfoPopoverProps {
  task: FormattedDownloadTask
  modsFolder?: string | null
  onOpenFolder?: () => void
  onOpenChange?: (open: boolean) => void
}

export function DownloadInfoPopover({
  task,
  modsFolder,
  onOpenFolder,
  onOpenChange,
}: DownloadInfoPopoverProps) {
  const [copiedField, setCopiedField] = React.useState<string | null>(null)
  const [open, setOpen] = React.useState(false)

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    onOpenChange?.(nextOpen)
  }

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 1800)
  }

  const sourceUrl = `https://mods.factorio.com/mod/${task.rawId}`
  const destinationPath = modsFolder
    ? `${modsFolder.replace(/[/\\]$/, "")}\\${task.fileName}`
    : task.fileName

  const handleOpenDirectory = async () => {
    if (onOpenFolder) {
      onOpenFolder()
      return
    }
    try {
      let folder: string | null = modsFolder || null
      if (!folder) {
        folder = await invoke<string | null>("get_mods_folder")
      }
      if (!folder) {
        folder = await invoke<string>("detect_default_mods_folder")
      }
      if (folder) {
        await invoke("open_folder_in_explorer", { path: folder })
      }
    } catch (err) {
      console.error("Failed to open destination folder:", err)
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-[26px] p-0 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer shrink-0"
                  aria-label={`View details for ${task.title}`}
                >
                  <Info className="size-3.5" />
                </Button>
              }
            />
          }
        />
        <TooltipContent side="top">Download details</TooltipContent>
      </Tooltip>

      <PopoverContent
        align="end"
        side="bottom"
        className="w-80 p-3.5 space-y-3 text-xs font-sans shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <PopoverHeader className="pb-1 border-b border-border/40">
          <PopoverTitle className="text-xs font-semibold text-foreground flex items-center justify-between">
            <span className="truncate pr-2">{task.title}</span>
            <span className="font-mono text-[10px] text-muted-foreground shrink-0">
              v{task.version}
            </span>
          </PopoverTitle>
        </PopoverHeader>

        <div className="space-y-2.5 text-[11px]">
          {/* Filename */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Filename</span>
              <button
                type="button"
                onClick={() => copyToClipboard(task.fileName, "fileName")}
                className="hover:text-foreground inline-flex items-center gap-1 cursor-pointer"
                title="Copy filename"
              >
                {copiedField === "fileName" ? (
                  <Check className="size-2.5 text-emerald-500" />
                ) : (
                  <Copy className="size-2.5" />
                )}
                <span>{copiedField === "fileName" ? "Copied" : "Copy"}</span>
              </button>
            </div>
            <p className="font-mono text-[10px] bg-muted/50 p-1.5 rounded break-all select-all text-foreground">
              {task.fileName}
            </p>
          </div>

          {/* Source URL */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Source URL</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => copyToClipboard(sourceUrl, "sourceUrl")}
                  className="hover:text-foreground inline-flex items-center gap-1 cursor-pointer"
                  title="Copy URL"
                >
                  {copiedField === "sourceUrl" ? (
                    <Check className="size-2.5 text-emerald-500" />
                  ) : (
                    <Copy className="size-2.5" />
                  )}
                  <span>{copiedField === "sourceUrl" ? "Copied" : "Copy"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => openModPortal(task.rawId)}
                  className="hover:text-primary inline-flex items-center gap-0.5 cursor-pointer text-muted-foreground"
                  title="Open in portal"
                >
                  <ExternalLink className="size-2.5" />
                  <span>Portal</span>
                </button>
              </div>
            </div>
            <p className="font-mono text-[10px] bg-muted/50 p-1.5 rounded break-all select-all text-muted-foreground">
              {sourceUrl}
            </p>
          </div>

          {/* Checksum (SHA1) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Checksum (SHA-1)</span>
              {task.sha1 && (
                <button
                  type="button"
                  onClick={() => copyToClipboard(task.sha1!, "sha1")}
                  className="hover:text-foreground inline-flex items-center gap-1 cursor-pointer"
                  title="Copy SHA-1"
                >
                  {copiedField === "sha1" ? (
                    <Check className="size-2.5 text-emerald-500" />
                  ) : (
                    <Copy className="size-2.5" />
                  )}
                  <span>{copiedField === "sha1" ? "Copied" : "Copy"}</span>
                </button>
              )}
            </div>
            <p
              className={cn(
                "font-mono text-[10px] bg-muted/50 p-1.5 rounded break-all select-all",
                task.sha1 ? "text-foreground" : "text-muted-foreground italic"
              )}
            >
              {task.sha1 || "Not specified by portal"}
            </p>
          </div>

          {/* Destination Path */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Destination Path</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => copyToClipboard(destinationPath, "destPath")}
                  className="hover:text-foreground inline-flex items-center gap-1 cursor-pointer"
                  title="Copy destination path"
                >
                  {copiedField === "destPath" ? (
                    <Check className="size-2.5 text-emerald-500" />
                  ) : (
                    <Copy className="size-2.5" />
                  )}
                  <span>{copiedField === "destPath" ? "Copied" : "Copy"}</span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenDirectory}
                  className="hover:text-foreground inline-flex items-center gap-0.5 cursor-pointer text-muted-foreground"
                  title="Open destination folder"
                >
                  <Folder className="size-2.5" />
                  <span>Folder</span>
                </button>
              </div>
            </div>
            <p className="font-mono text-[10px] bg-muted/50 p-1.5 rounded break-all select-all text-muted-foreground">
              {destinationPath}
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
