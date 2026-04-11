const DRAFT_VERSION = "1"
const DRAFT_EXPIRE_MS = 2 * 60 * 60 * 1000 // 2小时

interface DraftData {
  data: any
  savedAt: number
  version: string
}

/** 保存草稿到 sessionStorage */
export function saveDraft(key: string, data: any): void {
  try {
    const draft: DraftData = { data, savedAt: Date.now(), version: DRAFT_VERSION }
    sessionStorage.setItem(key, JSON.stringify(draft))
  } catch {
    // sessionStorage 满或不可用时静默失败
  }
}

/** 读取草稿，过期或版本不匹配返回 null */
export function loadDraft(key: string): any | null {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const draft: DraftData = JSON.parse(raw)
    if (draft.version !== DRAFT_VERSION) {
      clearDraft(key)
      return null
    }
    if (Date.now() - draft.savedAt > DRAFT_EXPIRE_MS) {
      clearDraft(key)
      return null
    }
    return draft.data
  } catch {
    return null
  }
}

/** 清除草稿 */
export function clearDraft(key: string): void {
  try {
    sessionStorage.removeItem(key)
  } catch {
    // ignore
  }
}
