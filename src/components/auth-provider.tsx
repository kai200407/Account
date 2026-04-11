"use client"

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react"
import { api, getToken, setToken, removeToken, setUserRole } from "@/lib/api-client"

interface User {
  id: string
  name: string
  phone: string
  role: string
  shopName: string
  tenantId: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  isOwner: boolean
  login: (phone: string, password: string) => Promise<string | null>
  register: (data: RegisterData) => Promise<string | null>
  logout: () => void
}

interface RegisterData {
  shopName: string
  name: string
  phone: string
  password: string
}

const AuthContext = createContext<AuthContextType | null>(null)

/** 检查当前路径是否已在登录页，避免重复跳转 */
function isOnLoginPage(): boolean {
  if (typeof window === "undefined") return false
  return window.location.pathname === "/login"
}

/** 跳转到登录页（带来源页参数） */
function redirectToLogin() {
  if (isOnLoginPage()) return
  const from = window.location.pathname
  const search = from && from !== "/" ? `?from=${encodeURIComponent(from)}` : ""
  window.location.href = `/login${search}`
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const syncRole = (u: User | null) => {
    if (u) {
      setUserRole(u.role)
    }
  }

  const fetchUser = useCallback(async () => {
    const token = getToken()
    if (!token) {
      setLoading(false)
      return
    }

    const result = await api<User>("/api/auth/me")
    if (result.success && result.data) {
      setUser(result.data)
      syncRole(result.data)
    } else {
      // /me 接口失败（token 无效或过期），清除凭证
      removeToken()
      setUser(null)
      // 如果不在登录页，跳转
      if (!isOnLoginPage()) {
        redirectToLogin()
      }
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void fetchUser()
  }, [fetchUser])

  const login = useCallback(
    async (phone: string, password: string): Promise<string | null> => {
      const result = await api<{ token: string; user: User }>(
        "/api/auth/login",
        {
          method: "POST",
          body: JSON.stringify({ phone, password }),
        }
      )

      if (result.success && result.data) {
        setToken(result.data.token)
        setUser({
          ...result.data.user,
          tenantId: "",
        })
        syncRole(result.data.user)
        await fetchUser()
        return null
      }

      return result.error ?? "登录失败"
    },
    [fetchUser]
  )

  const register = useCallback(
    async (data: RegisterData): Promise<string | null> => {
      const result = await api<{ token: string; user: User }>(
        "/api/auth/register",
        {
          method: "POST",
          body: JSON.stringify(data),
        }
      )

      if (result.success && result.data) {
        setToken(result.data.token)
        setUser({
          ...result.data.user,
          tenantId: "",
        })
        syncRole(result.data.user)
        await fetchUser()
        return null
      }

      return result.error ?? "注册失败"
    },
    [fetchUser]
  )

  const logout = useCallback(() => {
    removeToken()
    setUser(null)
    window.location.href = "/login"
  }, [])

  const isOwner = user?.role === "owner"

  return (
    <AuthContext.Provider value={{ user, loading, isOwner, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return context
}
