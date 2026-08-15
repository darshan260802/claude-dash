import { useState } from 'react'
import { Copy, Check } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy(e: React.MouseEvent) {
    // A copy action should always be terminal — never also trigger a
    // clickable ancestor (e.g. this button rendered inside a session card
    // that navigates on click). stopPropagation belongs here, at the
    // source, rather than relying on every call site to remember to wrap it.
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard API unavailable (e.g. insecure context) — silently no-op
    }
  }

  return (
    <Button variant="ghost" size="icon" className={cn('size-6', className)} onClick={handleCopy} aria-label="Copy to clipboard">
      {copied ? <Check /> : <Copy />}
    </Button>
  )
}
