const TOKEN_KEY = "jizhang_token"

export function getToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

interface ApiResult<T> {
  success: boolean
  data?: T
  error?: string
}

export async function api<T>(
  url: string,
  options: RequestInit = {}
): Promise<ApiResult<T>> {
  const token = getToken()
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  try {
    const res = await fetch(url, { ...options, headers })
    const data = await res.json()

    if (res.status === 401) {
      removeToken()
      if (typeof window !== "undefined") {
        window.location.href = "/login"
      }
    }

    return data
  } catch {
    return { success: false, error: "网络请求失败，请检查网络" }
  }
}
