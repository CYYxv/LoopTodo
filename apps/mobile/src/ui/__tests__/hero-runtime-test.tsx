import { render } from '@testing-library/react-native';

import { Button } from '../hero-runtime';

describe('Button', () => {
  test('wraps multiple text fragments in a native Text node', async () => {
    const screen = await render(<Button>{'月度'} {'¥9.9'}</Button>);
    expect(screen.getByText('月度 ¥9.9')).toBeTruthy();
  });
});
