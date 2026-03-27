import { NextResponse } from "next/server"

interface ApiSuccessResponse<T> {
  success: true
  data: T
}

interface ApiErrorResponse {
  success: false
  error: string
}

type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse

export function apiSuccess<T>(data: T, status = 200) {
  const body: ApiResponse<T> = { success: true, data }
  return NextResponse.json(body, { status })
}

export function apiError(error: string, status = 400) {
  const body: ApiResponse<never> = { success: false, error }
  return NextResponse.json(body, { status })
}
