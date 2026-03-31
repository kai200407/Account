import type { Metadata } from "next"
import { Toaster } from "@/components/ui/sonner"
import { AuthProvider } from "@/components/auth-provider"
import "./globals.css"

export const metadata: Metadata = {
  title: "记账系统",
  description: "简洁好用的批发零售记账系统",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full font-sans">
        <AuthProvider>
          {children}
          <Toaster position="top-center" richColors />
        </AuthProvider>
      </body>
    </html>
  )
}
