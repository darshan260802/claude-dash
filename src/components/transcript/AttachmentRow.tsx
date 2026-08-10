import { useState } from 'react'
import type { TurnDTO } from '@shared/types.ts'
import { Paperclip, CaretRight, CaretDown } from '@phosphor-icons/react'

const LABELS: Record<string, string> = {
  task_reminder: 'Task reminder',
  edited_text_file: 'File edited externally',
  skill_listing: 'Skill listing updated',
  queued_command: 'Command queued',
  deferred_tools_delta: 'Tools updated',
  agent_listing_delta: 'Agent listing updated',
  plan_mode_exit: 'Exited plan mode',
  command_permissions: 'Command permissions changed',
  file: 'File attached',
  plan_mode: 'Entered plan mode',
  hook_success: 'Hook ran',
  hook_additional_context: 'Hook added context',
  mcp_instructions_delta: 'MCP instructions updated',
  auto_mode: 'Auto mode changed',
  opened_file_in_ide: 'Opened file in IDE',
  ultra_effort_enter: 'Ultra effort enabled',
  ultra_effort_exit: 'Ultra effort disabled',
  date_change: 'Date changed',
  selected_lines_in_ide: 'Selected lines in IDE',
  read_truncation_notice: 'Read output truncated',
  plan_file_reference: 'Plan file referenced',
}

export function AttachmentRow({ turn }: { turn: TurnDTO }) {
  const [expanded, setExpanded] = useState(false)
  const label = (turn.subtype && LABELS[turn.subtype]) || turn.subtype || 'Attachment'

  return (
    <div className="ml-9 text-[11px] text-muted-foreground">
      <button type="button" onClick={() => setExpanded((e) => !e)} className="flex items-center gap-1 hover:text-foreground">
        {expanded ? <CaretDown className="size-3" /> : <CaretRight className="size-3" />}
        <Paperclip className="size-3" />
        {label}
      </button>
      {expanded && turn.content && <pre className="mt-1 max-h-40 overflow-auto rounded bg-muted/40 p-2 font-mono text-[10px] whitespace-pre-wrap">{turn.content}</pre>}
    </div>
  )
}
