import jwt from "jsonwebtoken"

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error("JWT_SECRET is required")
  }
  return secret
}

export interface JwtPayload {
  userId: string
  tenantId: string
  role: string
  userName: string
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: "7d" })
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret())
    if (!decoded || typeof decoded !== "object") return null

    const data = decoded as Record<string, unknown>
    if (
      typeof data.userId !== "string" ||
      typeof data.tenantId !== "string" ||
      typeof data.role !== "string" ||
      typeof data.userName !== "string"
    ) {
      return null
    }

    return {
      userId: data.userId,
      tenantId: data.tenantId,
      role: data.role,
      userName: data.userName,
    }
  } catch {
    return null
  }
}
