import { Badge } from '@/components/ui/badge'

const SHORT_NAMES: Record<string, string> = {
  'claude-opus-5': 'Opus 5',
  'claude-sonnet-5': 'Sonnet 5',
  'claude-haiku-4-5-20251001': 'Haiku 4.5',
  'claude-opus-4-8': 'Opus 4.8',
  'deepseek-v4-pro': 'DeepSeek V4 Pro',
  '<synthetic>': 'synthetic',
}

export function modelShortName(model: string): string {
  return SHORT_NAMES[model] ?? model
}

export function ModelChip({ model, className }: { model: string; className?: string }) {
  return (
    <Badge variant="secondary" className={className}>
      {modelShortName(model)}
    </Badge>
  )
}
