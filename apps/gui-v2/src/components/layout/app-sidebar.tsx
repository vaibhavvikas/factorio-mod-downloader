import * as React from "react"
import { Compass, Package, Download, Settings } from "lucide-react"
import appIcon from "@/assets/app_icon.png"
import downloaderBanner from "@/assets/downloader_banner.png"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Badge } from "@/components/ui/badge"
import { useModQueueStore } from "@/stores/use-mod-queue-store"
import { useDownloadsStore } from "@/stores/use-downloads-store"

export type TabId = "explore" | "queue" | "downloads" | "settings"

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  activeTab: TabId
  setActiveTab: (tab: TabId) => void
}

export function AppSidebar({
  activeTab,
  setActiveTab,
  ...props
}: AppSidebarProps) {
  const targetModsCount = useModQueueStore((s) => s.targetMods.length)
  const activeDownloadsCount = useDownloadsStore((s) => s.activeCount)

  return (
    <Sidebar
      variant="inset"
      collapsible="icon"
      className="h-full group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4)))]"
      {...props}
    >
      <SidebarHeader data-tauri-drag-region className="[.platform-mac_&]:pt-8">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tabIndex={-1}
              className="hover:bg-transparent active:bg-transparent hover:text-inherit active:text-inherit focus-visible:ring-0 cursor-default select-none"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg shrink-0">
                <img
                  src={appIcon}
                  alt="App Icon"
                  className="size-8 object-contain select-none"
                  draggable={false}
                />
              </div>
              <div className="flex-1 min-w-0 flex items-center overflow-hidden">
                <img
                  src={downloaderBanner}
                  alt="Factorio Mod Downloader"
                  className="h-[34px] w-auto max-w-[180px] object-contain object-left select-none drop-shadow-sm shrink-0"
                  draggable={false}
                />
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Discover</SidebarGroupLabel>
          <SidebarMenu className="gap-1">
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Explore"
                isActive={activeTab === "explore"}
                onClick={() => setActiveTab("explore")}
              >
                <Compass className="size-4" />
                <span>Explore</span>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Mod Queue"
                isActive={activeTab === "queue"}
                onClick={() => setActiveTab("queue")}
              >
                <Package className="size-4" />
                <span>Mod Queue</span>
                {targetModsCount > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-auto text-[10px] font-mono h-4 px-1.5 font-bold"
                  >
                    {targetModsCount}
                  </Badge>
                )}
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-2 border-t border-sidebar-border/40">
        <SidebarMenu className="gap-1">
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Downloads"
              isActive={activeTab === "downloads"}
              onClick={() => setActiveTab("downloads")}
            >
              <Download className="size-4" />
              <span>Downloads</span>
              {activeDownloadsCount > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-auto text-[10px] font-mono h-4 px-1.5 font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400"
                >
                  {activeDownloadsCount}
                </Badge>
              )}
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Settings"
              isActive={activeTab === "settings"}
              onClick={() => setActiveTab("settings")}
            >
              <Settings className="size-4" />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
