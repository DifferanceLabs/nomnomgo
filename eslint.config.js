const { defineConfig, globalIgnores } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const globals = require('globals');

module.exports = defineConfig([
  globalIgnores([
    '.expo/**',
    '.expo-export-check/**',
    '.route-import-test-build/**',
    'archive/**',
    'dist/**',
    'node_modules/**',
  ]),
  expoConfig,
  {
    files: ['api/**/*.js', 'eslint.config.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
]);
