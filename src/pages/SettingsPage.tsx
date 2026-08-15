import { Navigate } from 'react-router'
import { useSettings, usePatchSettings } from '@/hooks/useSettings'
import { useShareContext } from '@/hooks/useShare'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDuration } from '@shared/format.ts'
import { RelativeTime } from '@/components/common/RelativeTime'
import { ArrowsClockwise, Warning } from '@phosphor-icons/react'
import { toast } from 'sonner'

export function SettingsPage() {
  const { data: settings, isLoading } = useSettings()
  const patch = usePatchSettings()
  const { data: shareCtx } = useShareContext()

  // Cosmetic only — a global-mode visitor reaches this route in the same
  // tree as the owner (AppSidebar hides the nav entry, but a direct URL
  // still resolves). The real boundary is server-side: PATCH /api/settings
  // is 403 for any non-owner regardless of mode.
  if (shareCtx?.isOwner === false) return <Navigate to="/" replace />

  if (isLoading || !settings) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">claude-dash v{settings.version}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Data source</CardTitle>
          <CardDescription>Where claude-dash reads Claude Code's local session logs from.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {settings.claudeDirs.map((dir) => (
            <code key={dir} className="rounded bg-muted px-2 py-1 font-mono text-xs">
              {dir}
            </code>
          ))}
          <p className="text-xs text-muted-foreground">
            Detected via <Badge variant="outline">{settings.detectedFrom}</Badge> — override with <code>--claude-dir</code> or <code>CLAUDE_CONFIG_DIR</code>.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Index</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-semibold tabular-nums">{settings.index.projects}</p>
            <p className="text-xs text-muted-foreground">Projects</p>
          </div>
          <div>
            <p className="text-2xl font-semibold tabular-nums">{settings.index.sessions}</p>
            <p className="text-xs text-muted-foreground">Sessions</p>
          </div>
          <div>
            <p className="text-2xl font-semibold tabular-nums">{settings.index.turns}</p>
            <p className="text-xs text-muted-foreground">Turns</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-medium">Pricing</CardTitle>
            <CardDescription>Sourced from LiteLLM's model pricing database.</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => patch.mutate({ pricingRefresh: true }, { onSuccess: () => toast.success('Pricing refreshed') })}
            disabled={patch.isPending}
          >
            <ArrowsClockwise className={patch.isPending ? 'animate-spin' : ''} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Source</span>
            <Badge variant={settings.pricing.source === 'live' ? 'default' : 'secondary'}>{settings.pricing.source}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Models priced</span>
            <span>{settings.pricing.modelCount}</span>
          </div>
          {settings.pricing.fetchedAt && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Last fetched</span>
              <RelativeTime iso={settings.pricing.fetchedAt} />
            </div>
          )}
          {settings.pricing.error && (
            <p className="flex items-center gap-1.5 text-xs text-destructive">
              <Warning className="size-3.5" /> {settings.pricing.error}
            </p>
          )}
          {settings.pricing.unpricedModels.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Unpriced models seen in your logs</span>
              <div className="flex flex-wrap gap-1">
                {settings.pricing.unpricedModels.map((m) => (
                  <Badge key={m} variant="outline" className="text-[10px]">
                    {m}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Liveness</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Considered "live"</span>
            <span>within {formatDuration(settings.liveWindowMs)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Considered "recent"</span>
            <span>within {formatDuration(settings.recentWindowMs)}</span>
          </div>
          <p className="text-xs text-muted-foreground italic">Inferred from file activity — Claude Code's logs don't record an explicit "session is active" flag.</p>
        </CardContent>
      </Card>

      {settings.unknownRecordTypes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Schema drift detected</CardTitle>
            <CardDescription>Record types found in your logs that this version of claude-dash doesn't recognize yet.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-1.5">
            {settings.unknownRecordTypes.map((t) => (
              <Badge key={t} variant="outline" className="text-[10px]">
                {t}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
