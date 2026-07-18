declare const require: (moduleName: string) => any
declare const __dirname: string

const fs = require('fs')
const path = require('path')

test('loads HeroUI styles and defines the LoopTodo light and dark blue themes', () => {
  const css = fs.readFileSync(path.resolve(__dirname, '../../../global.css'), 'utf8')

  expect(css).toContain("@import 'heroui-native/styles'")
  expect(css).toContain("@source './node_modules/heroui-native/lib'")
  expect(css).toContain('--accent: #2563eb')
  expect(css).toContain('--accent: #5b8cff')
  expect(css).toContain('--surface: #ffffff')
  expect(css).toContain('--surface: #191b20')
})

test('the compatibility bottom sheet uses HeroUI Native', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../bottom-sheet-modal.tsx'), 'utf8')

  expect(source).toContain("from 'heroui-native/bottom-sheet'")
  expect(source).not.toContain('PanResponder')
  expect(source).not.toContain('<Modal')
})
