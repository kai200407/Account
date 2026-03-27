"use client"

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react"
import { api, getToken, setToken, removeToken } from "@/lib/api-client"

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchUser = useCallback(async () => {
    const token = getToken()
    if (!token) {
      setLoading(false)
      return
    }

    const result = await api<User>("/api/auth/me")
    if (result.success && result.data) {
      setUser(result.data)
    } else {
      removeToken()
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchUser()
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

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
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
