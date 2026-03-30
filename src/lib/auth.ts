import jwt from "jsonwebtoken"

const JWT_SECRET = process.env.JWT_SECRET ?? "fallback-secret-do-not-use-in-prod"

export interface JwtPayload {
  userId: string
  tenantId: string
  role: string
  userName: string
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" })
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload
    return decoded
  } catch {
    return null
  }
}
