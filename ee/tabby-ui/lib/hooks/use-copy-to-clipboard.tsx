'use client'

import * as React from 'react'
import copy from 'copy-to-clipboard'
import { toast } from 'react-hot-toast'

export interface useCopyToClipboardProps {
  timeout?: number
  onError?: (e?: any) => void
}

export function useCopyToClipboard({
  timeout = 2000,
  onError
}: useCopyToClipboardProps) {
  const [isCopied, setIsCopied] = React.useState<Boolean>(false)

  const onCopySuccess = () => {
    setIsCopied(true)

    setTimeout(() => {
      setIsCopied(false)
    }, timeout)
  }

  const onCopyError = (error?: any) => {
    onError?.(error)
    toast.error('Failed to copy.')
  }

  const copyToClipboard = (value: string) => {
    if (typeof window === 'undefined') return
    if (!value) return

    if (!!navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(value)
        .then(onCopySuccess)
        .catch(onCopyError)
    } else {
      const copyResult = copy(value)
      if (copyResult) {
        onCopySuccess()
      } else {
        onCopyError()
      }
    }
  }

  return { isCopied, copyToClipboard }
}
