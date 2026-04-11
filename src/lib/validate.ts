import { ZodSchema } from 'zod'

type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }

export function validateBody<T>(schema: ZodSchema<T>, body: unknown): ValidationResult<T> {
  const result = schema.safeParse(body)
  if (result.success) {
    return { success: true, data: result.data }
  }
  const firstError = result.error.issues[0]
  const error = firstError?.message ?? '输入参数不正确'
  return { success: false, error }
}
