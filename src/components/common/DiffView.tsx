import { cn } from '@/lib/utils'

interface Hunk {
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  lines: string[]
}

function isHunkArray(v: unknown): v is Hunk[] {
  return Array.isArray(v) && v.every((h) => h && typeof h === 'object' && Array.isArray((h as Hunk).lines))
}

/** Renders Claude Code's `toolUseResult.structuredPatch` — the same shape the
 * `diff` npm package's `structuredPatch()` produces (array of hunks, each
 * line prefixed ' '/'+'/'-'). Falls back to a plain JSON dump for any other
 * shape rather than crashing on an unexpected format. */
export function DiffView({ patch, className }: { patch: unknown; className?: string }) {
  if (!isHunkArray(patch) || patch.length === 0) {
    return <pre className={cn('overflow-x-auto rounded-md border border-border bg-muted/40 p-2 font-mono text-[11px]', className)}>{JSON.stringify(patch, null, 2)}</pre>
  }

  return (
    <div className={cn('overflow-hidden rounded-md border border-border font-mono text-[11px] leading-relaxed', className)}>
      {patch.map((hunk, hi) => (
        <div key={hi}>
          <div className="bg-muted/60 px-2 py-0.5 text-muted-foreground">
            @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
          </div>
          {hunk.lines.map((line, li) => {
            const marker = line[0]
            const body = line.slice(1)
            return (
              <div
                key={li}
                className={cn(
                  'px-2 whitespace-pre',
                  marker === '+' && 'bg-[oklch(0.55_0.15_142_/_0.12)] text-[oklch(0.4_0.13_142)] dark:text-[oklch(0.8_0.15_142)]',
                  marker === '-' && 'bg-destructive/10 text-destructive',
                )}
              >
                {marker}
                {body}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
