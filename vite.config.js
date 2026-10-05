import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// base './' ทำให้ใช้ได้กับ GitHub Pages ทุกชื่อ repo
export default defineConfig({ plugins: [react()], base: './' })
