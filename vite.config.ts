import {defineConfig} from 'vite'
import react, {reactCompilerPreset} from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from "@tailwindcss/vite";
import {fileURLToPath, URL} from 'node:url'

const API_PORT = process.env.CLAUDE_DASH_API_PORT ?? '4317'

// https://vite.dev/config/
export default defineConfig({
    plugins: [
        tailwindcss(),
        react(),
        babel({presets: [reactCompilerPreset()]})
    ],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
            '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
        },
    },
    server: {
        proxy: {
            '/api': {
                target: `http://127.0.0.1:${API_PORT}`,
                changeOrigin: true,
                ws: true,
            },
        },
    },
    build: {
        outDir: 'dist-web',
        emptyOutDir: true,
        rollupOptions: {
            output: {
                manualChunks(id: string) {
                    if (id.includes('node_modules')) {
                        if (id.includes('recharts') || id.includes('d3-')) return 'recharts'
                        if (id.includes('/gsap/') || id.includes('@gsap')) return 'gsap'
                        if (id.includes('react-markdown') || id.includes('remark') || id.includes('mdast') || id.includes('micromark') || id.includes('unist') || id.includes('hast')) return 'markdown'
                        if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('react-router') || id.includes('@tanstack')) return 'vendor'
                    }
                },
            },
        },
    },
    base: './',
})
