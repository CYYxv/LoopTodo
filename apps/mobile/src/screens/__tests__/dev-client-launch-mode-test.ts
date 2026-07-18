declare const require: (moduleName: string) => any;

const appConfig = require('../../../app.json');

test('development client opens the launcher before loading a project', () => {
  const plugin = appConfig.expo.plugins.find((entry: unknown) => Array.isArray(entry) && entry[0] === 'expo-dev-client');

  expect(plugin).toEqual(['expo-dev-client', { launchMode: 'launcher' }]);
});
