import type { Icon } from '@phosphor-icons/react'
import {
  Terminal,
  FileText,
  PencilSimple,
  FilePlus,
  Robot,
  Question,
  ClipboardText,
  Globe,
  MagnifyingGlass,
  Plug,
  Wrench,
  ListChecks,
} from '@phosphor-icons/react'

export interface ToolMeta {
  icon: Icon
  colorToken: string
  label: string
}

const MCP_RE = /^mcp__([^_]+(?:_[^_]+)*?)__(.+)$/

const TOOL_META: Record<string, ToolMeta> = {
  Bash: { icon: Terminal, colorToken: 'chart-1', label: 'Bash' },
  Read: { icon: FileText, colorToken: 'chart-2', label: 'Read' },
  Write: { icon: FilePlus, colorToken: 'chart-3', label: 'Write' },
  Edit: { icon: PencilSimple, colorToken: 'chart-3', label: 'Edit' },
  TaskCreate: { icon: ListChecks, colorToken: 'chart-4', label: 'Task' },
  TaskUpdate: { icon: ListChecks, colorToken: 'chart-4', label: 'Task' },
  Agent: { icon: Robot, colorToken: 'chart-5', label: 'Agent' },
  Task: { icon: Robot, colorToken: 'chart-5', label: 'Agent' },
  AskUserQuestion: { icon: Question, colorToken: 'chart-2', label: 'Question' },
  ExitPlanMode: { icon: ClipboardText, colorToken: 'chart-4', label: 'Plan' },
  WebFetch: { icon: Globe, colorToken: 'chart-2', label: 'Web Fetch' },
  WebSearch: { icon: MagnifyingGlass, colorToken: 'chart-2', label: 'Web Search' },
}

const DEFAULT_META: ToolMeta = { icon: Wrench, colorToken: 'muted-foreground', label: 'Tool' }
const MCP_META: Omit<ToolMeta, 'label'> = { icon: Plug, colorToken: 'chart-1' }

export function metaForTool(name: string): ToolMeta {
  const mcp = MCP_RE.exec(name)
  if (mcp) return { ...MCP_META, label: mcp[2] }
  return TOOL_META[name] ?? { ...DEFAULT_META, label: name }
}

export function parseMcpToolName(name: string): { server: string; tool: string } | null {
  const m = MCP_RE.exec(name)
  return m ? { server: m[1], tool: m[2] } : null
}
