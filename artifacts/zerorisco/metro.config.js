const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;

// Simplificando para o EAS
process.env.EXPO_ROUTER_APP_ROOT = path.join(projectRoot, 'app');

const config = getDefaultConfig(projectRoot);

module.exports = config;
