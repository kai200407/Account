import { NextRequest } from "next/server"
import { writeFile } from "fs/promises"
import { existsSync, mkdirSync } from "fs"
import path from "path"
import { requireAuth, isAuthError } from "@/lib/api-auth"
import { apiSuccess, apiError } from "@/lib/api-response"

const MAX_SIZE = 2 * 1024 * 1024 // 2MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"]

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if (isAuthError(auth)) return auth

  try {
    const uploadDir = path.join(process.cwd(), "public/uploads/products", auth.tenantId)

    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) return apiError("请选择图片")
    if (!ALLOWED_TYPES.includes(file.type)) {
      return apiError("仅支持 JPG/PNG/WebP 格式")
    }
    if (file.size > MAX_SIZE) {
      return apiError("图片不能超过 2MB")
    }

    // 确保目录存在
    if (!existsSync(uploadDir)) {
      mkdirSync(uploadDir, { recursive: true })
    }

    // 生成文件名
    const ext = file.type.split("/")[1] === "jpeg" ? "jpg" : file.type.split("/")[1]
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const filePath = path.join(uploadDir, fileName)

    // 写入文件
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(filePath, buffer)

    const imageUrl = `/uploads/products/${auth.tenantId}/${fileName}`
    return apiSuccess({ imageUrl }, 201)
  } catch (error) {
    console.error("上传图片失败:", error)
    return apiError("上传图片失败", 500)
  }
}
