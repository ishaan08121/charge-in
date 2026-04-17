const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

const webStubs = {
  'react-native-maps': path.resolve(__dirname, 'src/mocks/react-native-maps.web.js'),
  'react-native-webview': path.resolve(__dirname, 'src/mocks/react-native-webview.web.js'),
};

const originalResolver = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && webStubs[moduleName]) {
    return { filePath: webStubs[moduleName], type: 'sourceFile' };
  }
  if (originalResolver) {
    return originalResolver(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
