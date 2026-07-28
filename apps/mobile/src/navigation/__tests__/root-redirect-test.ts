import { rootRedirect } from '../root-redirect';

test('redirects a signed-in user with an active session back to the session route', () => {
  expect(rootRedirect('signed_in', '(tabs)', true)).toBe('/session');
  expect(rootRedirect('signed_in', 'session', true)).toBeNull();
});

test('keeps login redirects compatible when no session is active', () => {
  expect(rootRedirect('signed_out', '(tabs)', false)).toBe('/login');
  expect(rootRedirect('signed_in', 'login', false)).toBe('/tasks');
});
