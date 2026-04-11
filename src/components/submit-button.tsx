"use client"

import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import type { ComponentProps } from "react"

interface SubmitButtonProps extends ComponentProps<typeof Button> {
  loading?: boolean
  children: React.ReactNode
}

export function SubmitButton({ loading, children, disabled, ...props }: SubmitButtonProps) {
  return (
    <Button disabled={loading || disabled} {...props}>
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          提交中...
        </>
      ) : (
        children
      )}
    </Button>
  )
}
