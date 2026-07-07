import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // 相対パスにして GitHub Pages のサブパス (https://user.github.io/repo/) でも動くようにする
  base: './',
})
