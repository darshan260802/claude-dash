import { useState } from 'react'
import type { ToolResultDTO } from '@shared/types.ts'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

export function BashResultView({ result }: { result: ToolResultDTO }) {
  const [tab, setTab] = useState(result.stderr ? 'stderr' : 'stdout')
  const hasStderr = !!result.stderr && result.stderr.trim().length > 0

  return (
    <div className="rounded-md border border-border bg-muted/30">
      {result.interrupted && <div className="border-b border-border bg-destructive/10 px-2 py-1 text-[11px] text-destructive">Interrupted</div>}
      {hasStderr ? (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="h-7 w-full justify-start rounded-none border-b border-border bg-transparent px-1">
            <TabsTrigger value="stdout" className="h-6 text-[11px]">
              stdout
            </TabsTrigger>
            <TabsTrigger value="stderr" className="h-6 text-[11px] text-destructive data-[state=active]:text-destructive">
              stderr
            </TabsTrigger>
          </TabsList>
          <TabsContent value="stdout">
            <OutputBlock text={result.stdout} />
          </TabsContent>
          <TabsContent value="stderr">
            <OutputBlock text={result.stderr} destructive />
          </TabsContent>
        </Tabs>
      ) : (
        <OutputBlock text={result.stdout} />
      )}
    </div>
  )
}

function OutputBlock({ text, destructive }: { text?: string; destructive?: boolean }) {
  if (!text || text.trim().length === 0) {
    return <div className="p-2 text-[11px] text-muted-foreground italic">no output</div>
  }
  return (
    <pre className={cn('max-h-72 overflow-auto p-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap', destructive && 'text-destructive')}>{text}</pre>
  )
}
