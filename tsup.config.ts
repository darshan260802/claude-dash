import { defineConfig } from 'tsup'
import { mkdir, copyFile } from 'node:fs/promises'

export default defineConfig({
  entry: { index: 'server/main.ts' },
  outDir: 'dist-server',
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  noExternal: [/.*/],
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: false,
  dts: false,
  // Some bundled CJS-interop shims reference `require` in ESM output — this is
  // the standard tsup-on-Node workaround.
  banner: {
    js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);",
  },
  loader: { '.json': 'json' },
  async onSuccess() {
    // fallback.json is read from disk at runtime via a resolve()'d path
    // (PricingService.init), not imported — tsup's JS bundling never sees
    // that reference, so the file must be copied alongside the bundle
    // explicitly or the packaged CLI silently loses its pricing fallback.
    await mkdir('dist-server/pricing', { recursive: true })
    await copyFile('server/pricing/fallback.json', 'dist-server/pricing/fallback.json')
  },
})
