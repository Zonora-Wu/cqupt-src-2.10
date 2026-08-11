import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // Data loading is intentionally initiated from effects throughout this app.
      // Keep dependency and Rules of Hooks checks enabled; this compiler-oriented
      // rule rejects valid imperative loading functions that synchronously set loading state.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    files: ['src/components/graphics/**/*.{ts,tsx}', 'src/components/guest/BeamsBackground.tsx', 'src/components/guest/KaliLaptopShowcase.tsx'],
    rules: {
      // Three.js owns mutable scene objects; frame loops must update them in place.
      'react-hooks/immutability': 'off',
      // These scene modules export reusable render helpers alongside components.
      'react-refresh/only-export-components': 'off',
    },
  },
])
