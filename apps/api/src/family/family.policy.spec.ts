import { sanitizeFamilyTaskPatch } from './family.policy';
test('family change requests cannot alter ownership or active session fields', () => { expect(sanitizeFamilyTaskPatch({ title: '新标题', userId: 'attacker', activeSessionId: null })).toEqual({ title: '新标题' }); });
