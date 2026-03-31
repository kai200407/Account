export interface PaginationParams {
  page: number
  limit: number
  skip: number
}

function parsePositiveInt(raw: string | null, fallback: number): number {
  const value = Number.parseInt(raw ?? "", 10)
  if (!Number.isFinite(value) || value <= 0) return fallback
  return value
}

export function getPaginationParams(
  url: URL,
  options?: { defaultLimit?: number; maxLimit?: number }
): PaginationParams {
  const defaultLimit = options?.defaultLimit ?? 20
  const maxLimit = options?.maxLimit ?? 100

  const page = parsePositiveInt(url.searchParams.get("page"), 1)
  const requestedLimit = parsePositiveInt(url.searchParams.get("limit"), defaultLimit)
  const limit = Math.min(requestedLimit, maxLimit)

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  }
}
