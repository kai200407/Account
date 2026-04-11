"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Loader2 } from "lucide-react"

const REMEMBER_KEY = "jizhang_remember_phone"

function validatePhone(phone: string): string | null {
  if (!phone) return "请输入手机号"
  if (!/^1\d{10}$/.test(phone)) return "手机号格式不正确"
  return null
}

function validatePassword(password: string): string | null {
  if (!password) return "请输入密码"
  if (password.length < 6) return "密码至少6位"
  return null
}

export default function LoginPage() {
  const router = useRouter()
  const { login, register } = useAuth()
  const [tab, setTab] = useState<"login" | "register">("login")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // 登录表单
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [remember, setRemember] = useState(false)

  // 注册表单
  const [regPhone, setRegPhone] = useState("")
  const [regName, setRegName] = useState("")
  const [regPassword, setRegPassword] = useState("")
  const [regConfirm, setRegConfirm] = useState("")
  const [shopName, setShopName] = useState("")

  // 表单验证错误（字段级）
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  // 读取记住的手机号
  useEffect(() => {
    const saved = localStorage.getItem(REMEMBER_KEY)
    if (saved) {
      setPhone(saved)
      setRemember(true)
    }
  }, [])

  function clearFieldError(field: string) {
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    const errors: Record<string, string> = {}
    const phoneErr = validatePhone(phone)
    if (phoneErr) errors.phone = phoneErr
    const pwdErr = validatePassword(password)
    if (pwdErr) errors.password = pwdErr
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }
    setFieldErrors({})

    setLoading(true)
    try {
      const err = await login(phone, password)
      if (err) {
        setError(err)
      } else {
        if (remember) {
          localStorage.setItem(REMEMBER_KEY, phone)
        } else {
          localStorage.removeItem(REMEMBER_KEY)
        }
        router.push("/")
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    const errors: Record<string, string> = {}
    if (!shopName.trim()) errors.shopName = "请输入店铺名称"
    if (!regName.trim()) errors.regName = "请输入姓名"
    const phoneErr = validatePhone(regPhone)
    if (phoneErr) errors.regPhone = phoneErr
    const pwdErr = validatePassword(regPassword)
    if (pwdErr) errors.regPassword = pwdErr
    if (!regConfirm) errors.regConfirm = "请确认密码"
    else if (regPassword !== regConfirm) errors.regConfirm = "两次密码不一致"
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }
    setFieldErrors({})

    setLoading(true)
    try {
      const err = await register({
        shopName: shopName.trim(),
        name: regName.trim(),
        phone: regPhone,
        password: regPassword,
      })
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center pb-2 pt-8">
          {/* Logo */}
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground text-2xl font-bold shadow-sm">
            进
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">智能进销存</h1>
          <p className="text-sm text-muted-foreground mt-1">
            高效管理，轻松记账
          </p>
        </CardHeader>

        <CardContent className="px-6 pb-8">
          <Tabs
            value={tab}
            onValueChange={(v) => {
              setTab(v as "login" | "register")
              setError("")
              setFieldErrors({})
            }}
          >
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login">登录</TabsTrigger>
              <TabsTrigger value="register">注册</TabsTrigger>
            </TabsList>

            {/* ====== 登录 ====== */}
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-phone">手机号</Label>
                  <Input
                    id="login-phone"
                    type="tel"
                    placeholder="请输入手机号"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value)
                      clearFieldError("phone")
                    }}
                    className="h-11"
                  />
                  {fieldErrors.phone && (
                    <p className="text-xs text-destructive">{fieldErrors.phone}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="login-password">密码</Label>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="请输入密码"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      clearFieldError("password")
                    }}
                    className="h-11"
                  />
                  {fieldErrors.password && (
                    <p className="text-xs text-destructive">{fieldErrors.password}</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    id="remember"
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <Label htmlFor="remember" className="text-sm font-normal cursor-pointer">
                    记住手机号
                  </Label>
                </div>

                {error && (
                  <p className="text-sm text-destructive text-center">{error}</p>
                )}

                <Button type="submit" className="w-full h-11" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      登录中...
                    </>
                  ) : (
                    "登录"
                  )}
                </Button>
              </form>
            </TabsContent>

            {/* ====== 注册 ====== */}
            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reg-shop">店铺名称</Label>
                  <Input
                    id="reg-shop"
                    placeholder="例如：旺旺灯具店"
                    value={shopName}
                    onChange={(e) => {
                      setShopName(e.target.value)
                      clearFieldError("shopName")
                    }}
                    className="h-11"
                  />
                  {fieldErrors.shopName && (
                    <p className="text-xs text-destructive">{fieldErrors.shopName}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reg-name">您的姓名</Label>
                  <Input
                    id="reg-name"
                    placeholder="例如：张三"
                    value={regName}
                    onChange={(e) => {
                      setRegName(e.target.value)
                      clearFieldError("regName")
                    }}
                    className="h-11"
                  />
                  {fieldErrors.regName && (
                    <p className="text-xs text-destructive">{fieldErrors.regName}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reg-phone">手机号</Label>
                  <Input
                    id="reg-phone"
                    type="tel"
                    placeholder="请输入手机号"
                    value={regPhone}
                    onChange={(e) => {
                      setRegPhone(e.target.value)
                      clearFieldError("regPhone")
                    }}
                    className="h-11"
                  />
                  {fieldErrors.regPhone && (
                    <p className="text-xs text-destructive">{fieldErrors.regPhone}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reg-password">密码</Label>
                  <Input
                    id="reg-password"
                    type="password"
                    placeholder="至少6位密码"
                    value={regPassword}
                    onChange={(e) => {
                      setRegPassword(e.target.value)
                      clearFieldError("regPassword")
                    }}
                    className="h-11"
                  />
                  {fieldErrors.regPassword && (
                    <p className="text-xs text-destructive">{fieldErrors.regPassword}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reg-confirm">确认密码</Label>
                  <Input
                    id="reg-confirm"
                    type="password"
                    placeholder="再次输入密码"
                    value={regConfirm}
                    onChange={(e) => {
                      setRegConfirm(e.target.value)
                      clearFieldError("regConfirm")
                    }}
                    className="h-11"
                  />
                  {fieldErrors.regConfirm && (
                    <p className="text-xs text-destructive">{fieldErrors.regConfirm}</p>
                  )}
                </div>

                {error && (
                  <p className="text-sm text-destructive text-center">{error}</p>
                )}

                <Button type="submit" className="w-full h-11" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      注册中...
                    </>
                  ) : (
                    "注册"
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
