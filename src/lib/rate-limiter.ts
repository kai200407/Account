interface AttemptRecord {
  count: number
  firstAttempt: number // timestamp ms
  lockedUntil: number | null // timestamp ms
}

const MAX_ATTEMPTS = 5
const WINDOW_MS = 60 * 1000 // 1 分钟
const LOCK_DURATION_MS = 15 * 60 * 1000 // 15 分钟
const CLEANUP_THRESHOLD_MS = 60 * 60 * 1000 // 1 小时

const attempts = new Map<string, AttemptRecord>()

export function checkRateLimit(
  key: string
): { allowed: boolean; retryAfter?: number } {
  const record = attempts.get(key)
  if (!record) return { allowed: true }

  const now = Date.now()

  // 锁定中
  if (record.lockedUntil && now < record.lockedUntil) {
    return { allowed: false, retryAfter: Math.ceil((record.lockedUntil - now) / 1000) }
  }

  // 窗口已过，重置
  if (now - record.firstAttempt > WINDOW_MS) {
    attempts.delete(key)
    return { allowed: true }
  }

  return { allowed: true }
}

export function recordFailedAttempt(key: string): void {
  const now = Date.now()
  const record = attempts.get(key)

  if (!record || now - record.firstAttempt > WINDOW_MS) {
    // 新窗口
    attempts.set(key, { count: 1, firstAttempt: now, lockedUntil: null })
    return
  }

  record.count += 1

  if (record.count >= MAX_ATTEMPTS) {
    record.lockedUntil = now + LOCK_DURATION_MS
  }
}

export function resetAttempts(key: string): void {
  attempts.delete(key)
}

// 定期清理过期记录，防内存泄漏
setInterval(() => {
  const now = Date.now()
  const keysToDelete: string[] = []
  attempts.forEach((record, key) => {
    const isExpired =
      record.lockedUntil && now >= record.lockedUntil
        ? now - record.lockedUntil > CLEANUP_THRESHOLD_MS - LOCK_DURATION_MS
        : now - record.firstAttempt > CLEANUP_THRESHOLD_MS

    if (isExpired) {
      keysToDelete.push(key)
    }
  })
  keysToDelete.forEach((key) => attempts.delete(key))
}, CLEANUP_THRESHOLD_MS)
