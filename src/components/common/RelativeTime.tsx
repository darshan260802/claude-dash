import { useEffect, useState } from 'react'
import { relativeTime } from '@shared/format.ts'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export function RelativeTime({ iso, className }: { iso: string | number; className?: string }) {
  const [, forceTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  if (!iso) return <span className={className}>—</span>

  const abs = new Date(iso).toLocaleString()
  return (
    <Tooltip>
      <TooltipTrigger render={<span className={className} />}>{relativeTime(iso)}</TooltipTrigger>
      <TooltipContent>{abs}</TooltipContent>
    </Tooltip>
  )
}
