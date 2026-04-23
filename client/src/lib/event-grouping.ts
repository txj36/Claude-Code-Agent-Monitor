/**
 * @file event-grouping.ts
 * @description Client-side grouping of DashboardEvent rows by `tool_use_id`.
 * A single tool invocation typically emits two events — `PreToolUse` (Working)
 * and `PostToolUse` (Connected) — both carrying the same `tool_use_id` inside
 * their hook payload. Grouping collapses each such pair into one `EventGroup`
 * so the UI can show "Bash: curl … (2.3s)" as one row instead of two, while
 * keeping the individual events accessible when the group is expanded.
 *
 * Events without a `tool_use_id` (Stop, Notification, TurnDuration, etc.)
 * become single-event groups and render identically to a flat row.
 */

import type { DashboardEvent } from "./types";

export type EventGroup = {
  /** Stable key — either the tool_use_id, or `single:<event.id>` for
   *  ungroupable events. Safe to use as a React list key. */
  key: string;
  /** Events in the group, sorted chronologically (oldest → newest). */
  events: DashboardEvent[];
  /** Tool name shared by all events in the group (null for non-tool events). */
  tool_name: string | null;
  /** The underlying tool_use_id, or null for single-event groups. */
  tool_use_id: string | null;
  /** Timestamp of the earliest event in the group. */
  firstAt: string;
  /** Timestamp of the latest event in the group. */
  lastAt: string;
  /** Wall-clock duration between first and last event, or null if only one. */
  durationMs: number | null;
  /** Best summary to display — prefers the most recent non-empty summary. */
  summary: string | null;
};

function extractToolUseId(event: DashboardEvent): string | null {
  if (!event.data) return null;
  try {
    const parsed = JSON.parse(event.data);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const v = (parsed as Record<string, unknown>).tool_use_id;
      if (typeof v === "string" && v.length > 0) return v;
    }
  } catch {
    // Malformed payload — fall through to null.
  }
  return null;
}

export function groupEvents(events: DashboardEvent[]): EventGroup[] {
  const byKey = new Map<string, DashboardEvent[]>();
  const order: string[] = [];

  for (const event of events) {
    const toolUseId = extractToolUseId(event);
    const key = toolUseId ?? `single:${event.id}`;
    if (!byKey.has(key)) {
      byKey.set(key, []);
      order.push(key);
    }
    byKey.get(key)!.push(event);
  }

  const groups: EventGroup[] = [];
  for (const key of order) {
    const items = byKey.get(key)!;
    const sorted = [...items].sort((a, b) => a.created_at.localeCompare(b.created_at));
    const first = sorted[0]!;
    const last = sorted[sorted.length - 1]!;
    const durationMs =
      sorted.length > 1
        ? Math.max(
            0,
            new Date(last.created_at).getTime() - new Date(first.created_at).getTime()
          )
        : null;
    const summary =
      [...sorted].reverse().find((e) => e.summary && e.summary.length > 0)?.summary ?? null;

    groups.push({
      key,
      events: sorted,
      tool_name: first.tool_name,
      tool_use_id: key.startsWith("single:") ? null : key,
      firstAt: first.created_at,
      lastAt: last.created_at,
      durationMs,
      summary,
    });
  }

  // Groups are returned newest-first (same order as flat events list).
  groups.sort((a, b) => b.firstAt.localeCompare(a.firstAt));
  return groups;
}

/** Best-effort status tag per event_type — mirrors the mapping used by
 *  ActivityFeed / SessionDetail so grouped rows can show a status progression. */
export function statusFromEventType(
  type: string
): "working" | "connected" | "completed" | "error" | "idle" {
  switch (type) {
    case "PreToolUse":
      return "working";
    case "PostToolUse":
      return "connected";
    case "Stop":
    case "SubagentStop":
    case "Compaction":
      return "completed";
    case "error":
    case "APIError":
      return "error";
    default:
      return "idle";
  }
}

export function formatGroupDuration(ms: number | null): string | null {
  if (ms == null) return null;
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60_000);
  const secs = Math.floor((ms % 60_000) / 1000);
  return `${mins}m ${secs}s`;
}
