module.exports = {
  root: true,
  env: { browser: true, es2020: true, node: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 2020, sourceType: 'module' },
  plugins: ['@typescript-eslint'],
  rules: {
    // no-explicit-any 保持 off：当前 263 处 any，改 warn 会一次性爆炸，留后续迭代
    '@typescript-eslint/no-explicit-any': 'off',
    // 以下规则从 off 恢复为 warn（不直接 error，避免一次性大量失败）
    '@typescript-eslint/no-unused-vars': 'warn',
    '@typescript-eslint/ban-ts-comment': 'warn',
    '@typescript-eslint/no-require-imports': 'off',
    'no-undef': 'off',
    'no-empty': 'off',
    'no-useless-escape': 'off',
    'no-cond-assign': 'off',
    'no-fallthrough': 'warn',
    'no-irregular-whitespace': 'off',
    'prefer-const': 'warn',
    'no-constant-condition': 'warn',
    'no-inner-declarations': 'off',
  },
  ignorePatterns: ['dist/', 'src-tauri/', 'node_modules/', '*.js'],
};
