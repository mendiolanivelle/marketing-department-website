import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { validatePublicBuildEnv } from './scripts/validate-public-env.mjs'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const fileEnv = loadEnv(mode, process.cwd(), 'VITE_')
  const publicEnv = {
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL ?? fileEnv.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY ?? fileEnv.VITE_SUPABASE_ANON_KEY,
    VITE_TURNSTILE_SITE_KEY: process.env.VITE_TURNSTILE_SITE_KEY ?? fileEnv.VITE_TURNSTILE_SITE_KEY,
    VITE_PRIVATE_STORAGE_ENABLED: process.env.VITE_PRIVATE_STORAGE_ENABLED ?? fileEnv.VITE_PRIVATE_STORAGE_ENABLED,
  }
  validatePublicBuildEnv(publicEnv)

  return {
    plugins: [react(), tailwindcss()],
    base: process.env.VITE_BASE || fileEnv.VITE_BASE || '/',
  }
})
