import * as React from "react"
import { AlertTriangle, RefreshCw, Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { invoke } from "@tauri-apps/api/core"

interface Props {
  children: React.ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
  copied: boolean
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null, copied: false }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an unhandled error:", error, errorInfo)
    this.setState({ errorInfo })

    const payload = `[REACT_CRASH] ${error?.name || "Error"}: ${error?.message || "Unknown error"}\nStack: ${error?.stack || "No stack"}\nComponent Stack: ${errorInfo?.componentStack || "No component stack"}`

    try {
      invoke("log_message", {
        level: "Error",
        tag: "REACT_CRASH",
        message: payload,
      }).catch(() => {})
    } catch {
      // Backend logging fallback
    }
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
    window.location.reload()
  }

  handleCopy = async () => {
    const errorDetails = [
      `Error: ${this.state.error?.name}: ${this.state.error?.message}`,
      `Stack:\n${this.state.error?.stack || "None"}`,
      `Component Stack:\n${this.state.errorInfo?.componentStack || "None"}`,
    ].join("\n\n")

    try {
      await navigator.clipboard.writeText(errorDetails)
      this.setState({ copied: true })
      setTimeout(() => this.setState({ copied: false }), 2000)
    } catch {
      // ignore
    }
  }

  render() {
    if (this.state.hasError) {
      const errorMsg = this.state.error?.message || "An unexpected error occurred in the application interface."
      const stack = this.state.error?.stack || this.state.errorInfo?.componentStack

      return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center p-6 bg-background text-foreground space-y-4">
          <div className="size-12 rounded-full bg-destructive/15 text-destructive flex items-center justify-center">
            <AlertTriangle className="size-6" />
          </div>
          <div className="text-center space-y-1.5 max-w-xl w-full">
            <h2 className="text-lg font-bold">Something went wrong</h2>
            <p className="text-xs text-muted-foreground">
              An unexpected error occurred in the application interface.
            </p>
            <ScrollArea className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 text-left text-xs text-destructive max-h-56 font-mono select-text">
              <div className="p-3">
                <p className="font-semibold">{this.state.error?.name || "Error"}: {errorMsg}</p>
                {stack && (
                  <pre className="mt-2 text-[11px] text-muted-foreground whitespace-pre-wrap break-all font-mono">
                    {stack}
                  </pre>
                )}
              </div>
            </ScrollArea>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={this.handleCopy}
              className="cursor-pointer gap-1.5"
              aria-label="Copy error details"
            >
              {this.state.copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
              <span>{this.state.copied ? "Copied" : "Copy Details"}</span>
            </Button>
            <Button
              size="sm"
              onClick={this.handleReload}
              className="cursor-pointer gap-1.5"
              aria-label="Reload application"
            >
              <RefreshCw className="size-3.5" />
              <span>Reload Application</span>
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

