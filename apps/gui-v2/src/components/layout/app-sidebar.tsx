import * as React from "react"
import { Compass, Cog } from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export type TabId = "explore"

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  activeTab: TabId
  setActiveTab: (tab: TabId) => void
}

export function AppSidebar({
  activeTab,
  setActiveTab,
  ...props
}: AppSidebarProps) {
  return (
    <Sidebar
      variant="inset"
      collapsible="icon"
      className="h-full group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4)))]"
      {...props}
    >
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                <Cog className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">Factorio Mod</span>
                <span className="truncate text-xs text-muted-foreground">Downloader</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Discover</SidebarGroupLabel>
          <SidebarMenu>
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
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
