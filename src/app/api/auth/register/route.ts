import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { hashSync } from "bcryptjs"
import { signToken } from "@/lib/auth"
import { apiSuccess, apiError } from "@/lib/api-response"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { shopName, name, phone, password } = body

    // 输入验证
    if (!shopName || !name || !phone || !password) {
      return apiError("请填写完整信息（店铺名、姓名、手机号、密码）")
    }

    if (!/^1\d{10}$/.test(phone)) {
      return apiError("手机号格式不正确")
    }

    if (password.length < 6) {
      return apiError("密码至少6位")
    }

    // 检查手机号是否已注册
    const existingUser = await prisma.user.findUnique({
      where: { phone },
    })

    if (existingUser) {
      return apiError("该手机号已注册")
    }

    // 创建租户和用户（事务）
    const result = await prisma.$transaction(async (tx) => {
      // 创建租户
      const tenant = await tx.tenant.create({
        data: { name: shopName },
      })

      // 创建默认分类
      await Promise.all(
        ["电疗灯具", "厨房用品", "卫浴用品", "其他"].map((catName, index) =>
          tx.category.create({
            data: {
              tenantId: tenant.id,
              name: catName,
              sortOrder: index,
            },
          })
        )
      )

      // 创建用户
      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          phone,
          password: hashSync(password, 10),
          name,
          role: "owner",
        },
      })

      return { tenant, user }
    })

    // 生成 JWT
    const token = signToken({
      userId: result.user.id,
      tenantId: result.tenant.id,
      role: result.user.role,
    })

    return apiSuccess(
      {
        token,
        user: {
          id: result.user.id,
          name: result.user.name,
          phone: result.user.phone,
          role: result.user.role,
          shopName: result.tenant.name,
        },
      },
      201
    )
  } catch (error) {
    console.error("注册失败:", error)
    return apiError("注册失败，请稍后重试", 500)
  }
}
