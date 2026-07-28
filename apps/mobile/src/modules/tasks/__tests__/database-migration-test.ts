import { legacyDurationRepairSql, whitelistSchemaSql } from '../database';

test('repairs legacy countdown duration from the original session start payload when available', () => {
  expect(legacyDurationRepairSql).toContain("json_extract(payload, '$.plannedMinutes')");
  expect(legacyDurationRepairSql).toContain('MIN(');
  expect(legacyDurationRepairSql).not.toContain('estimate_minutes');
  expect(legacyDurationRepairSql).toContain('duration_seconds > planned_focus_seconds');
  expect(legacyDurationRepairSql).not.toContain("outcome = 'completed'");
  expect(legacyDurationRepairSql).toContain('version, applied_at) VALUES (7');
});

test('adds multi-list, task restriction, and session snapshot columns', () => {
  expect(whitelistSchemaSql).toContain('CREATE TABLE IF NOT EXISTS whitelist_lists');
  expect(whitelistSchemaSql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS whitelist_lists_one_active_default_idx');
  expect(whitelistSchemaSql).toContain('WHERE is_default = 1 AND archived_at IS NULL');
  expect(whitelistSchemaSql).toContain('restriction_mode');
  expect(whitelistSchemaSql).toContain('whitelist_list_id');
  expect(whitelistSchemaSql).toContain('allowed_packages_snapshot');
  expect(whitelistSchemaSql).toContain('whitelist_source');
  expect(whitelistSchemaSql).toContain('whitelist_package_count');
  expect(whitelistSchemaSql).toContain('restriction_effective');
  expect(whitelistSchemaSql).toContain('effective_minutes');
});
