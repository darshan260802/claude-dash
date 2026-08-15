import { useState } from 'react'
import { Link } from 'react-router'
import { ShareNetwork, Check, CircleNotch } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { CopyButton } from '@/components/common/CopyButton'
import { formatAccessCode } from '@shared/format.ts'
import { useShareContext, useShareStatus, useAddToShare, useRemoveFromShare } from '@/hooks/useShare'
import { ReplaceGlobalDialog } from './ReplaceGlobalDialog'

/** Share icon for one session or one agent transcript. Renders nothing for
 * a visitor — gated on isOwner rather than relying on the server 403ing an
 * unauthorized mutation, since an ungated useShareStatus() poll would
 * 403-spam from every visitor tab. */
export function ShareButton({ sessionId, agentId }: { sessionId: string; agentId?: string }) {
  const { data: ctx } = useShareContext()
  const isOwner = ctx?.isOwner === true

  const { data: status } = useShareStatus()
  const addToShare = useAddToShare()
  const removeFromShare = useRemoveFromShare()
  const [confirmReplace, setConfirmReplace] = useState(false)
  const [open, setOpen] = useState(false)

  if (!isOwner) return null

  const isShared =
    status?.state === 'active' &&
    (status.mode === 'global' || status.items.some((i) => i.sessionId === sessionId && (agentId ? i.agentId === agentId : !i.agentId)))

  function requestShare(replaceGlobal = false) {
    addToShare.mutate(
      { sessionId, agentId, replaceGlobal },
      {
        onError: (err) => {
          if ((err as { status?: number }).status === 409) setConfirmReplace(true)
        },
      },
    )
  }

  const busy = addToShare.isPending || status?.state === 'starting'

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              variant={isShared ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => (isShared ? setOpen(true) : requestShare())}
              disabled={busy}
            />
          }
        >
          {busy ? <CircleNotch className="animate-spin" /> : isShared ? <Check /> : <ShareNetwork />}
          {isShared ? 'Shared' : 'Share'}
        </PopoverTrigger>
        {isShared && status?.url && status.code && (
          <PopoverContent align="end" className="flex flex-col gap-3">
            {status.mode === 'global' ? (
              <p className="text-[11px] text-muted-foreground">
                Your whole dashboard is shared right now.{' '}
                <Link to="/share" className="text-primary hover:underline">
                  Manage sharing
                </Link>
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground">{agentId ? 'This agent transcript' : 'This session'} is shared via the link below.</p>
            )}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-medium text-muted-foreground">Public URL</span>
              <div className="flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-1.5">
                <code className="flex-1 truncate font-mono text-[11px]">{status.url}</code>
                <CopyButton text={status.url} />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-medium text-muted-foreground">Access code</span>
              <div className="flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-1.5">
                <code className="flex-1 font-mono text-[11px] tracking-wider">{formatAccessCode(status.code)}</code>
                <CopyButton text={status.code} />
              </div>
            </div>
            {status.mode === 'scoped' && (
              <Button
                variant="ghost"
                size="sm"
                className="justify-start text-destructive hover:text-destructive"
                onClick={() => removeFromShare.mutate({ sessionId, agentId })}
                disabled={removeFromShare.isPending}
              >
                Stop sharing this
              </Button>
            )}
          </PopoverContent>
        )}
      </Popover>
      <ReplaceGlobalDialog
        open={confirmReplace}
        onOpenChange={setConfirmReplace}
        isPending={addToShare.isPending}
        onConfirm={() => {
          requestShare(true)
          setConfirmReplace(false)
        }}
      />
    </>
  )
}
