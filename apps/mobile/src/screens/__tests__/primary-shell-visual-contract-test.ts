declare const require: (moduleName: string) => any;
declare const __dirname: string;

const fs = require('fs');
const path = require('path');

test('tab shell follows the resolved LoopTodo theme instead of the system hook', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../../../app/(tabs)/_layout.tsx'), 'utf8');

  expect(source).toContain('useLoopTodoTheme');
  expect(source).toContain("from 'heroui-native/pressable-feedback'");
  expect(source).not.toContain('useColorScheme');
});

test('my page uses HeroUI list and identity primitives', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../../../app/(tabs)/me.tsx'), 'utf8');

  expect(source).toContain("from 'heroui-native/avatar'");
  expect(source).toContain("from 'heroui-native/list-group'");
  expect(source).toContain("from 'heroui-native/separator'");
});
