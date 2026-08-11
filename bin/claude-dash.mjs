#!/usr/bin/env node
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const entry = pathToFileURL(join(here, '..', 'dist-server', 'index.js'))
const { main } = await import(entry)
await main(process.argv.slice(2))
