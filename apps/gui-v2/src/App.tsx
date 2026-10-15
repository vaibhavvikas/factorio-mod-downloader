import { ThemeProvider } from "@/components/layout/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AppLayout } from "@/components/layout/app-layout"

export function App() {
  return (
    <ThemeProvider defaultTheme="system">
      <TooltipProvider>
        <AppLayout />
      </TooltipProvider>
    </ThemeProvider>
  )
}

export default App

