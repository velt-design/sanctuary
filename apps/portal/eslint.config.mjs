import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';

/** @type {import('eslint').Linter.FlatConfig[]} */
const config = [
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'build/**',
      'next-env.d.ts',
      'public/**',
      'scripts/**',
      'tmp/**',
      'tsconfig.tsbuildinfo'
    ]
  },
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        ecmaFeatures: { jsx: true }
      },
      globals: {
        React: 'readonly',
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        Headers: 'readonly',
        process: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        performance: 'readonly',
        getComputedStyle: 'readonly',
        ResizeObserver: 'readonly'
      }
    },
    rules: {
      ...js.configs.recommended.rules,
      // Allow regexes that intentionally include control characters
      'no-control-regex': 'off',
      // Allow occasionally-empty blocks used as placeholders
      'no-empty': 'off',
      // Rely on TypeScript/compile-time checks for unused vars / undefineds
      'no-unused-vars': 'off',
      'no-unused-expressions': 'off',
      'no-undef': 'off',
      'no-useless-escape': 'off'
    }
  }
];

export default config;
