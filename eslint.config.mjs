import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';

/** @type {import('eslint').Linter.FlatConfig[]} */
const config = [
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/out/**',
      '**/build/**',
      '**/dist/**',
      '**/coverage/**',
      '**/vendor/**',
      'next-env.d.ts',
      '**/public/**',
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

const banLegacyCachingImports = {
  files: ['apps/portal/**/*.{js,jsx,ts,tsx}'],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        paths: [
          { name: 'swr', message: 'Do not use SWR. Use TanStack Query (@tanstack/react-query).' },
          { name: 'react-query', message: 'Legacy react-query is not allowed. Use @tanstack/react-query.' },
          { name: 'next/cache', message: 'Do not use next/cache for portal server-data caching. Use TanStack Query.' },
        ],
      },
    ],
  },
};

const banSupabaseReadsInPortalUI = {
  files: ['apps/portal/app/**/*.{ts,tsx}', 'apps/portal/components/**/*.{ts,tsx}'],
  ignores: ['apps/portal/app/api/**/*', '**/route.ts', '**/route.tsx', 'apps/portal/lib/queries/**/*'],
  rules: {
    'no-restricted-syntax': [
      'error',
      {
        selector: "CallExpression[callee.object.name='supabase'][callee.property.name='from']",
        message: 'Do not call supabase.from() in portal UI. Move reads into apps/portal/lib/queries and use useQuery.',
      },
    ],
  },
};

config.push(banLegacyCachingImports, banSupabaseReadsInPortalUI);

export default config;
