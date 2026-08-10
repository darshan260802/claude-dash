#!/usr/bin/env node
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const { main } = await import(join(here, '..', 'dist-server', 'index.js'))
await main(process.argv.slice(2))
