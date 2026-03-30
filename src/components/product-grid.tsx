"use client"

import Image from "next/image"

interface ProductGridProduct {
  id: string
  name: string
  unit: string
  wholesalePrice: number
  retailPrice: number
  costPrice?: number
  stock: number
  imageUrl?: string | null
  category?: { name: string } | null
}

interface ProductGridProps {
  products: ProductGridProduct[]
  onTap: (product: ProductGridProduct) => void
  selectedQuantities: Record<string, number>
  priceType: "retail" | "wholesale" | "cost"
}

// 分类对应的颜色
const CATEGORY_COLORS: Record<string, string> = {
  "电疗灯具": "bg-red-100 text-red-700",
  "厨房用品": "bg-blue-100 text-blue-700",
  "卫浴用品": "bg-green-100 text-green-700",
  "其他": "bg-gray-100 text-gray-600",
}

function getInitialColor(name: string, category?: string | null): string {
  if (category && CATEGORY_COLORS[category]) return CATEGORY_COLORS[category]
  // 根据名称第一个字符生成颜色
  const colors = [
    "bg-red-100 text-red-700",
    "bg-blue-100 text-blue-700",
    "bg-green-100 text-green-700",
    "bg-purple-100 text-purple-700",
    "bg-orange-100 text-orange-700",
    "bg-teal-100 text-teal-700",
  ]
  const idx = name.charCodeAt(0) % colors.length
  return colors[idx]
}

export function ProductGrid({ products, onTap, selectedQuantities, priceType }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <p className="text-center py-8 text-sm text-muted-foreground">
        暂无商品
      </p>
    )
  }

  return (
    <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
      {products.map((product) => {
        const qty = selectedQuantities[product.id] || 0
        const price = priceType === "wholesale"
          ? Number(product.wholesalePrice)
          : priceType === "cost"
            ? Number(product.costPrice ?? 0)
            : Number(product.retailPrice)

        const categoryName = product.category?.name
        const colorClass = getInitialColor(product.name, categoryName)

        return (
          <button
            key={product.id}
            type="button"
            onClick={() => onTap(product)}
            className={`relative flex flex-col items-center p-2 rounded-lg border transition-all active:scale-95 ${
              qty > 0
                ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                : "border-gray-200 hover:border-gray-300 bg-white"
            }`}
          >
            {/* 数量 badge */}
            {qty > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center z-10">
                {qty}
              </span>
            )}

            {/* 图片/首字母 */}
            <div className="w-14 h-14 rounded-lg overflow-hidden mb-1.5 shrink-0">
              {product.imageUrl ? (
                <Image
                  src={product.imageUrl}
                  alt={product.name}
                  width={56}
                  height={56}
                  className="object-cover w-full h-full"
                />
              ) : (
                <div className={`w-full h-full flex items-center justify-center ${colorClass}`}>
                  <span className="text-xl font-bold">
                    {product.name.charAt(0)}
                  </span>
                </div>
              )}
            </div>

            {/* 名称 */}
            <span className="text-xs font-medium text-center leading-tight line-clamp-1 w-full">
              {product.name}
            </span>

            {/* 价格 */}
            <span className="text-xs text-primary font-bold mt-0.5">
              ¥{price.toFixed(0)}
            </span>

            {/* 库存 */}
            {product.stock <= 5 && (
              <span className="text-[10px] text-red-500">
                仅剩{product.stock}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
