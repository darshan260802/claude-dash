import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useProjects } from '@/hooks/useSessions'

export interface SessionFilterState {
  project?: string
  model?: string
  liveOnly: boolean
}

const KNOWN_MODELS = ['claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5-20251001', 'claude-opus-4-8', 'deepseek-v4-pro']

export function SessionFilters({ value, onChange }: { value: SessionFilterState; onChange: (next: SessionFilterState) => void }) {
  const { data: projects } = useProjects()

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select value={value.project ?? 'all'} onValueChange={(v) => onChange({ ...value, project: !v || v === 'all' ? undefined : v })}>
        <SelectTrigger className="h-8 w-44 text-xs">
          <SelectValue placeholder="All projects" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All projects</SelectItem>
          {projects?.map((p) => (
            <SelectItem key={p.key} value={p.key}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={value.model ?? 'all'} onValueChange={(v) => onChange({ ...value, model: !v || v === 'all' ? undefined : v })}>
        <SelectTrigger className="h-8 w-44 text-xs">
          <SelectValue placeholder="All models" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All models</SelectItem>
          {KNOWN_MODELS.map((m) => (
            <SelectItem key={m} value={m}>
              {m}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-2">
        <Switch id="live-only" checked={value.liveOnly} onCheckedChange={(checked) => onChange({ ...value, liveOnly: checked })} />
        <Label htmlFor="live-only" className="text-xs text-muted-foreground">
          Live only
        </Label>
      </div>
    </div>
  )
}
