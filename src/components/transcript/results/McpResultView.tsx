import type { ToolResultDTO } from '@shared/types.ts'
import { GenericResultView } from './GenericResultView'

/** MCP tool results are, at the wire level, the same shape as any other
 * generic tool result — this component exists as its own file (rather than
 * reusing GenericResultView directly in the switch) so MCP-specific
 * rendering (e.g. structured payload detection) has an obvious place to grow
 * without touching the generic fallback. */
export function McpResultView({ result, session }: { result: ToolResultDTO; session: string }) {
  return <GenericResultView result={result} session={session} />
}
