module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: [
    'dist', 'dist-electron', 'release', 'releases', 'backups',
    'node_modules', 'server/dist', 'server/node_modules',
    'Sentinel Base', 'Sentinel Personal', '.eslintrc.cjs',
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  rules: {
    // Provider payloads and Electron bridge objects are runtime-validated at
    // their boundaries; forcing fake static shapes here reduces clarity.
    '@typescript-eslint/no-explicit-any': 'off',
    'no-useless-escape': 'off',
    'no-empty': ['error', { allowEmptyCatch: true }],
    'react-refresh/only-export-components': 'off',
  },
}
