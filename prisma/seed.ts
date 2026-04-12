import { PrismaClient } from "@prisma/client"
import { hashSync } from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  console.log("🌱 开始初始化数据...")

  // 创建示例租户
  const tenant = await prisma.tenant.create({
    data: { name: "示例店铺" },
  })
  console.log(`✅ 创建租户: ${tenant.name} (${tenant.id})`)

  // 创建管理员用户
  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      phone: "13800138000",
      password: hashSync("123456", 10),
      name: "管理员",
      role: "owner",
    },
  })
  console.log(`✅ 创建用户: ${user.name} (${user.phone})`)

  // 创建默认分类
  const categories = await Promise.all(
    ["电疗灯具", "厨房用品", "卫浴用品", "其他"].map((name, index) =>
      prisma.category.create({
        data: { tenantId: tenant.id, name, sortOrder: index },
      })
    )
  )
  console.log(`✅ 创建 ${categories.length} 个分类`)

  // 创建示例商品
  const products = await Promise.all([
    prisma.product.create({
      data: {
        tenantId: tenant.id,
        categoryId: categories[0].id,
        name: "红外理疗灯 TDP-A",
        sku: "DL-001",
        unit: "台",
        costPrice: 150,
        wholesalePrice: 220,
        retailPrice: 298,
        stock: 50,
        stockValue: 150 * 50,
      },
    }),
    prisma.product.create({
      data: {
        tenantId: tenant.id,
        categoryId: categories[1].id,
        name: "不锈钢水槽 双槽",
        sku: "CF-001",
        unit: "个",
        costPrice: 180,
        wholesalePrice: 260,
        retailPrice: 350,
        stock: 30,
        stockValue: 180 * 30,
      },
    }),
    prisma.product.create({
      data: {
        tenantId: tenant.id,
        categoryId: categories[2].id,
        name: "花洒套装 三功能",
        sku: "WY-001",
        unit: "套",
        costPrice: 85,
        wholesalePrice: 130,
        retailPrice: 188,
        stock: 100,
        stockValue: 85 * 100,
      },
    }),
  ])
  console.log(`✅ 创建 ${products.length} 个示例商品`)

  // 创建示例供应商
  const supplier = await prisma.supplier.create({
    data: {
      tenantId: tenant.id,
      name: "佛山灯具厂",
      contact: "张经理",
      phone: "13900139000",
      address: "广东省佛山市",
    },
  })
  console.log(`✅ 创建供应商: ${supplier.name}`)

  // 创建示例客户
  const customer = await prisma.customer.create({
    data: {
      tenantId: tenant.id,
      name: "李老板",
      phone: "13700137000",
      customerType: "wholesale",
    },
  })
  console.log(`✅ 创建客户: ${customer.name}`)

  console.log("\n🎉 初始化完成！")
  console.log("📱 登录账号: 13800138000")
  console.log("🔑 登录密码: 123456")
}

main()
  .catch((e) => {
    console.error("❌ 初始化失败:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
