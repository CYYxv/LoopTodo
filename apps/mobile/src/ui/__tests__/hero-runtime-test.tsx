import { render } from '@testing-library/react-native';

import { Button, Chip } from '../hero-runtime';

describe('Button', () => {
  test('wraps multiple text fragments in a native Text node', async () => {
    const screen = await render(<Button>{'月度'} {'¥9.9'}</Button>);
    expect(screen.getByText('月度 ¥9.9')).toBeTruthy();
  });
});

describe('Chip', () => {
  test('wraps multiple text fragments in a native Text node', async () => {
    const screen = await render(<Chip>{'专注模式 · '}{'倒计时'}</Chip>);
    expect(screen.getByText('专注模式 · 倒计时')).toBeTruthy();
  });
});
