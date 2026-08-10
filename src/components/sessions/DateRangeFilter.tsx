import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CalendarBlank } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

export interface DateRange {
  from?: string
  to?: string
}

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function startOfWeek(d: Date): Date {
  const x = startOfDay(d)
  const mondayOffset = (x.getDay() + 6) % 7
  x.setDate(x.getDate() - mondayOffset)
  return x
}

function startOfMonth(d: Date): Date {
  const x = startOfDay(d)
  x.setDate(1)
  return x
}

const SHORTCUTS: { label: string; range: () => DateRange }[] = [
  { label: 'All time', range: () => ({}) },
  { label: 'Today', range: () => ({ from: startOfDay(new Date()).toISOString() }) },
  { label: 'This week', range: () => ({ from: startOfWeek(new Date()).toISOString() }) },
  { label: 'This month', range: () => ({ from: startOfMonth(new Date()).toISOString() }) },
]

function toDateInputValue(iso?: string): string {
  return iso ? iso.slice(0, 10) : ''
}

function fromDateInputValue(v: string, endOfDay: boolean): string | undefined {
  if (!v) return undefined
  return endOfDay ? `${v}T23:59:59.999Z` : `${v}T00:00:00.000Z`
}

function sameRange(a: DateRange, b: DateRange): boolean {
  return (a.from ?? '') === (b.from ?? '') && (a.to ?? '') === (b.to ?? '')
}

export function DateRangeFilter({ value, onChange }: { value: DateRange; onChange: (next: DateRange) => void }) {
  const [open, setOpen] = useState(false)
  const active = SHORTCUTS.find((s) => sameRange(s.range(), value))
  const isCustom = !active && (value.from || value.to)
  const label = active ? active.label : isCustom ? 'Custom range' : 'All time'
  const isFiltered = !!(value.from || value.to)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<Button variant="outline" size="sm" className={cn('h-8 gap-1.5 text-xs', isFiltered && 'border-primary/40 text-primary')} nativeButton={false} />}
      >
        <CalendarBlank className="size-3.5" />
        {label}
      </PopoverTrigger>
      <PopoverContent className="w-60" align="start">
        <div className="flex flex-col gap-0.5">
          {SHORTCUTS.map((s) => {
            const isActive = sameRange(s.range(), value)
            return (
              <button
                key={s.label}
                type="button"
                onClick={() => {
                  onChange(s.range())
                  setOpen(false)
                }}
                className={cn('rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent', isActive && 'bg-accent font-medium text-accent-foreground')}
              >
                {s.label}
              </button>
            )
          })}
        </div>
        <div className="mt-2 flex flex-col gap-2 border-t border-border pt-2">
          <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
            From
            <input
              type="date"
              value={toDateInputValue(value.from)}
              max={toDateInputValue(value.to) || undefined}
              onChange={(e) => onChange({ ...value, from: fromDateInputValue(e.target.value, false) })}
              className="rounded-md border border-input bg-input/20 px-2 py-1 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
            To
            <input
              type="date"
              value={toDateInputValue(value.to)}
              min={toDateInputValue(value.from) || undefined}
              onChange={(e) => onChange({ ...value, to: fromDateInputValue(e.target.value, true) })}
              className="rounded-md border border-input bg-input/20 px-2 py-1 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
            />
          </label>
        </div>
      </PopoverContent>
    </Popover>
  )
}
