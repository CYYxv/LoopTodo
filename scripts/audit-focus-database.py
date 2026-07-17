import argparse
import csv
import datetime as dt
import sqlite3
from pathlib import Path


def format_time(value: int | None) -> str:
    if value is None:
        return ""
    return dt.datetime.fromtimestamp(value / 1000, dt.timezone.utc).astimezone().isoformat(timespec="seconds")


def minutes(value: int | None) -> str:
    if value is None:
        return ""
    return f"{value / 60:.2f}"


def main() -> None:
    parser = argparse.ArgumentParser(description="Audit LoopTodo focus durations without modifying the database.")
    parser.add_argument("database", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)

    connection = sqlite3.connect(f"file:{args.database.as_posix()}?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    rows = connection.execute(
        """
        SELECT
          focus_sessions.id,
          focus_sessions.task_id,
          COALESCE(tasks.title, '[deleted task]') AS task_title,
          focus_sessions.timer_mode,
          focus_sessions.outcome,
          focus_sessions.started_at,
          focus_sessions.planned_end_at,
          focus_sessions.ended_at,
          focus_sessions.planned_focus_seconds,
          focus_sessions.duration_seconds,
          focus_sessions.accumulated_paused_ms,
          CASE
            WHEN focus_sessions.ended_at IS NULL THEN NULL
            ELSE MAX(0, CAST((focus_sessions.ended_at - focus_sessions.started_at
              - COALESCE(focus_sessions.accumulated_paused_ms, 0)) / 1000 AS INTEGER))
          END AS inferred_active_seconds
        FROM focus_sessions
        LEFT JOIN tasks ON tasks.id = focus_sessions.task_id
        ORDER BY focus_sessions.started_at DESC
        """
    ).fetchall()
    connection.close()

    fields = [
        "id", "task_id", "task_title", "timer_mode", "outcome", "started_at", "planned_end_at", "ended_at",
        "planned_focus_seconds", "duration_seconds", "accumulated_paused_ms", "inferred_active_seconds",
        "recorded_minutes", "planned_minutes", "inferred_minutes", "anomaly_reason",
    ]
    report_rows = []
    for row in rows:
        planned = row["planned_focus_seconds"]
        recorded = row["duration_seconds"]
        inferred = row["inferred_active_seconds"]
        reasons = []
        if recorded is not None and planned is not None and recorded > planned + 1:
            reasons.append("recorded_exceeds_plan")
        if recorded is not None and inferred is not None and recorded > inferred + 1:
            reasons.append("recorded_exceeds_inferred_active")
        if recorded is not None and recorded >= 60 * 60:
            reasons.append("recorded_at_least_60_minutes")
        report_rows.append({
            **dict(row),
            "started_at": format_time(row["started_at"]),
            "planned_end_at": format_time(row["planned_end_at"]),
            "ended_at": format_time(row["ended_at"]),
            "recorded_minutes": minutes(recorded),
            "planned_minutes": minutes(planned),
            "inferred_minutes": minutes(inferred),
            "anomaly_reason": ";".join(reasons),
        })

    csv_path = args.output / "focus-session-audit.csv"
    with csv_path.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(report_rows)

    suspicious = [row for row in report_rows if row["anomaly_reason"]]
    total_seconds = sum(row["duration_seconds"] or 0 for row in rows)
    markdown_path = args.output / "focus-session-audit.md"
    with markdown_path.open("w", encoding="utf-8") as handle:
        handle.write("# LoopTodo 专注数据库审计\n\n")
        handle.write(f"- 记录总数：{len(rows)}\n")
        handle.write(f"- 数据库累计分钟：{total_seconds / 60:.2f}\n")
        handle.write(f"- 可疑记录数：{len(suspicious)}\n\n")
        handle.write("## 可疑记录\n\n")
        if not suspicious:
            handle.write("未发现满足当前规则的异常记录。\n")
        else:
            handle.write("| 任务 | 开始时间 | 记录分钟 | 计划分钟 | 推算分钟 | 原因 |\n")
            handle.write("| --- | --- | ---: | ---: | ---: | --- |\n")
            for row in suspicious:
                title = str(row["task_title"]).replace("|", "\\|")
                handle.write(
                    f"| {title} | {row['started_at']} | {row['recorded_minutes']} | "
                    f"{row['planned_minutes']} | {row['inferred_minutes']} | {row['anomaly_reason']} |\n"
                )

    print(markdown_path)
    print(csv_path)


if __name__ == "__main__":
    main()
