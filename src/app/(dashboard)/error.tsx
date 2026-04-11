"use client"

import { useEffect } from "react"
import { AlertTriangle, RotateCw } from "lucide-react"

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex items-center justify-center py-20">
      <div className="text-center space-y-4">
        <div className="mx-auto w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
          <AlertTriangle className="h-6 w-6 text-red-500" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">加载失败</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {error.message || "数据加载出现问题，请重试。"}
          </p>
        </div>
        <button
          onClick={reset}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/80 transition-colors"
        >
          <RotateCw className="h-3.5 w-3.5" />
          重试
        </button>
      </div>
    </div>
  )
}
