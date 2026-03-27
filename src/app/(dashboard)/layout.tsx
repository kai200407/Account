"use client"

import { useAuth } from "@/components/auth-provider"
import { Sidebar, MobileNav } from "@/components/sidebar"
import { MobileHeader } from "@/components/mobile-header"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login")
    }
  }, [loading, user, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <MobileHeader />

      {/* 主内容区 */}
      <main className="md:ml-56 pb-20 md:pb-4">
        <div className="p-4 max-w-5xl mx-auto">{children}</div>
      </main>

      <MobileNav />
    </div>
  )
}
