import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

/** Shown when the owner clicks Share on a specific session/agent while a
 * GLOBAL share is already running. Global -> scoped is a narrowing of an
 * already-distributed link, which is worth a pause: anyone holding that
 * link loses access to everything except the one thing being confirmed
 * here. The server enforces this as a 409 independent of this dialog — this
 * is just the UI's chance to explain the consequence before the owner opts
 * in via `replaceGlobal: true`. */
export function ReplaceGlobalDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  isPending: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>A global share is already running</DialogTitle>
          <DialogDescription>
            Your whole dashboard is currently shared at that link. Switching to sharing just this session stops the global share and narrows the{' '}
            <strong>same link</strong> down to only this — anyone who already has it loses access to everything else.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button onClick={onConfirm} disabled={isPending}>
            {isPending ? 'Switching…' : 'Share only this instead'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
