import sqlite3
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "audit-focus-database.py"


class AuditFocusDatabaseTest(unittest.TestCase):
    def test_supports_legacy_focus_session_schema(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            output = Path(temporary_directory)
            database = output / "looptodo.db"
            connection = sqlite3.connect(database)
            connection.executescript(
                """
                CREATE TABLE tasks(id TEXT PRIMARY KEY, title TEXT NOT NULL);
                CREATE TABLE focus_sessions(
                  id TEXT PRIMARY KEY, task_id TEXT NOT NULL, timer_mode TEXT NOT NULL,
                  outcome TEXT NOT NULL, started_at INTEGER NOT NULL, planned_end_at INTEGER,
                  ended_at INTEGER NOT NULL, duration_seconds INTEGER NOT NULL
                );
                INSERT INTO tasks VALUES('task-1', 'Legacy task');
                INSERT INTO focus_sessions VALUES(
                  'session-1', 'task-1', 'countdown', 'completed', 1000000, 1060000, 4510000, 3510
                );
                """
            )
            connection.commit()
            connection.close()

            result = subprocess.run(
                [sys.executable, str(SCRIPT), str(database), "--output", str(output)],
                capture_output=True,
                text=True,
            )

            self.assertEqual(result.returncode, 0, result.stderr)
            report = (output / "focus-session-audit.md").read_text(encoding="utf-8")
            self.assertIn("Legacy task", report)
            self.assertIn("recorded_exceeds_plan", report)


if __name__ == "__main__":
    unittest.main()
