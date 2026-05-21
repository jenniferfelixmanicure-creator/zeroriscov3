const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

// Must be set BEFORE getDefaultConfig so the transform-worker inlines it as
// a static string — fixes: "First argument of require.context should be a string"
// in pnpm monorepo builds on EAS.
process.env.EXPO_ROUTER_APP_ROOT = path.join(projectRoot, 'app');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files within the monorepo
config.watchFolders = [monorepoRoot];

// 2. Resolve packages from both the project root and the monorepo root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

module.exports = config;
