/* eslint-disable no-console */
const prefix = '[claude-dash]'

export const log = {
  info: (msg: string) => console.error(`${prefix} ${msg}`),
  warn: (msg: string) => console.error(`${prefix} warn: ${msg}`),
  error: (msg: string, err?: unknown) => console.error(`${prefix} error: ${msg}`, err ?? ''),
}
