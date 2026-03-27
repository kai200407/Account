"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function LoginPage() {
  const router = useRouter()
  const { login, register } = useAuth()
  const [isRegister, setIsRegister] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [shopName, setShopName] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      let err: string | null
      if (isRegister) {
        err = await register({ shopName, name, phone, password })
      } else {
        err = await login(phone, password)
      }

      if (err) {
        setError(err)
      } else {
        router.push("/")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-2xl">
            {isRegister ? "注册新店铺" : "记账系统"}
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {isRegister ? "创建您的店铺账号" : "登录您的账号"}
          </p>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="shopName">店铺名称</Label>
                  <Input
                    id="shopName"
                    placeholder="例如：旺旺灯具店"
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                    required
                    className="h-12 text-base"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">您的姓名</Label>
                  <Input
                    id="name"
                    placeholder="例如：张三"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="h-12 text-base"
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="phone">手机号</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="请输入手机号"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                className="h-12 text-base"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                placeholder="请输入密码（至少6位）"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="h-12 text-base"
              />
            </div>

            {error && (
              <p className="text-sm text-red-500 text-center">{error}</p>
            )}

            <Button
              type="submit"
              className="w-full h-12 text-base"
              disabled={loading}
            >
              {loading
                ? "请稍候..."
                : isRegister
                  ? "注册"
                  : "登录"}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              {isRegister ? "已有账号？" : "还没有账号？"}
              <button
                type="button"
                className="text-primary underline ml-1"
                onClick={() => {
                  setIsRegister(!isRegister)
                  setError("")
                }}
              >
                {isRegister ? "去登录" : "注册新店铺"}
              </button>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
