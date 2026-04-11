"use client"

import { useEffect } from "react"
import { AlertTriangle, RotateCw, Home } from "lucide-react"

export default function GlobalError({
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
    <html lang="zh-CN">
      <body className="min-h-screen bg-gray-50 font-sans antialiased">
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg border p-8 max-w-md w-full text-center space-y-4">
            <div className="mx-auto w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
              <AlertTriangle className="h-7 w-7 text-red-500" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">出了点问题</h1>
            <p className="text-sm text-muted-foreground">
              {error.message || "页面遇到了意外错误，请稍后重试。"}
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={reset}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/80 transition-colors"
              >
                <RotateCw className="h-4 w-4" />
                重试
              </button>
              <a
                href="/"
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg border border-border bg-background text-sm font-medium hover:bg-muted transition-colors"
              >
                <Home className="h-4 w-4" />
                返回首页
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}
