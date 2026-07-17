import { legacyDurationRepairSql } from '../database';

test('repairs legacy countdown duration from the original session start payload when available', () => {
  expect(legacyDurationRepairSql).toContain("json_extract(payload, '$.plannedMinutes')");
  expect(legacyDurationRepairSql).toContain('MIN(');
  expect(legacyDurationRepairSql).not.toContain('estimate_minutes');
  expect(legacyDurationRepairSql).toContain('duration_seconds > planned_focus_seconds');
  expect(legacyDurationRepairSql).toContain('version, applied_at) VALUES (6');
});
