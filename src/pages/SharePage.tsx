import { Navigate } from 'react-router'
import { ShareNetwork, Warning, ShieldWarning, CircleNotch, X } from '@phosphor-icons/react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/common/CopyButton'
import { RelativeTime } from '@/components/common/RelativeTime'
import { formatAccessCode } from '@shared/format.ts'
import { useShareContext, useShareStatus, useStartShare, useStopShare, useRemoveFromShare } from '@/hooks/useShare'

function CopyRow({ label, display, raw }: { label: string; display: string; raw: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2.5 py-2">
        <code className="flex-1 truncate font-mono text-sm tracking-wide">{display}</code>
        <CopyButton text={raw} />
      </div>
    </div>
  )
}

export function SharePage() {
  const { data: shareCtx } = useShareContext()
  const { data: status } = useShareStatus()
  const start = useStartShare()
  const stop = useStopShare()
  const removeFromShare = useRemoveFromShare()

  // Cosmetic only, same reasoning as SettingsPage's guard — the server 403s
  // every /api/share/* call for a non-owner regardless of mode.
  if (shareCtx?.isOwner === false) return <Navigate to="/" replace />

  const state = status?.state ?? 'idle'

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Share</h1>
        <p className="text-sm text-muted-foreground">Expose this dashboard — or a single session — over a public link, gated behind an access code.</p>
      </div>

      <Alert>
        <ShieldWarning />
        <AlertTitle>Full access while active — no read-only mode</AlertTitle>
        <AlertDescription>Anyone with the link and code sees exactly what you'd see. Stop sharing when you're done.</AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Whole dashboard</CardTitle>
          <CardDescription>
            Share every project and session. To share just one session or agent transcript instead, use the share icon on that session's page — it
            starts (or joins) the same link scoped to only what you pick.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm">
          {(state === 'idle' || state === 'error') && (
            <>
              {state === 'error' && status?.error && (
                <p className="flex items-center gap-1.5 text-xs text-destructive">
                  <Warning className="size-3.5" /> {status.error}
                </p>
              )}
              <Button onClick={() => start.mutate('global')} disabled={start.isPending} className="self-start">
                <ShareNetwork /> Start sharing
              </Button>
            </>
          )}

          {state === 'starting' && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <CircleNotch className="animate-spin" />
              Starting a tunnel — first run downloads a small binary, this can take a moment…
            </div>
          )}

          {state === 'active' && status && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-chart-2/15 px-2 py-0.5 text-xs font-medium text-chart-2">
                  <span className="size-1.5 rounded-full bg-chart-2" /> Active
                </span>
                <Badge variant="outline">{status.mode === 'global' ? 'Whole dashboard' : `${status.items.length} item${status.items.length === 1 ? '' : 's'} shared`}</Badge>
                {status.startedAt && (
                  <span className="text-xs text-muted-foreground">
                    started <RelativeTime iso={status.startedAt} />
                  </span>
                )}
              </div>

              <CopyRow label="Public URL" display={status.url ?? ''} raw={status.url ?? ''} />
              {status.code && <CopyRow label="Access code" display={formatAccessCode(status.code)} raw={status.code} />}

              {status.mode === 'scoped' && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Shared items</span>
                  {status.items.length === 0 && <p className="text-xs text-muted-foreground italic">Nothing shared yet — use the share icon on a session or agent page.</p>}
                  {status.items.map((item) => (
                    <div key={`${item.sessionId}:${item.agentId ?? ''}`} className="flex items-center justify-between gap-2 rounded-md border border-border px-2.5 py-1.5 text-xs">
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">{item.title}</span>
                        <span className="truncate text-muted-foreground">
                          {item.subtitle ? `${item.subtitle} · ` : ''}
                          {item.projectName}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => removeFromShare.mutate({ sessionId: item.sessionId, agentId: item.agentId })}
                        disabled={removeFromShare.isPending}
                        aria-label="Stop sharing this item"
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <Button variant="destructive" onClick={() => stop.mutate()} disabled={stop.isPending} className="self-start">
                {stop.isPending ? 'Stopping…' : 'Stop sharing'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
