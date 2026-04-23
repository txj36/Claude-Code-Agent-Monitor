/**
 * @file EventGroupRow.tsx
 * @description Compact row that represents one EventGroup (one tool_use_id, or
 * a single standalone event). Shows a status progression of the underlying
 * events — e.g. 🟢 → 🔵 for a Pre/Post pair — plus tool name, summary, and
 * the wall-clock duration between first and last event. Clicking the chevron
 * expands the group inline to reveal each underlying event row.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight } from "lucide-react";
import { AgentStatusBadge } from "./StatusBadge";
import { formatTime, timeAgo } from "../lib/format";
import { formatGroupDuration, statusFromEventType } from "../lib/event-grouping";
import type { EventGroup } from "../lib/event-grouping";

type EventGroupRowProps = {
  group: EventGroup;
  /** Called when the row's click area (time/summary) is activated. Allows
   *  callers to navigate to the session or do nothing. */
  onRowActivate?: () => void;
};

export function EventGroupRow({ group, onRowActivate }: EventGroupRowProps) {
  const { t } = useTranslation("common");
  const [expanded, setExpanded] = useState(false);

  const statusSequence = dedupeConsecutive(group.events.map((e) => statusFromEventType(e.event_type)));
  const duration = formatGroupDuration(group.durationMs);
  const canExpand = group.events.length > 1;

  return (
    <div>
      <div className="flex items-center px-5 py-3 gap-4 hover:bg-surface-4 transition-colors min-w-0">
        <button
          type="button"
          onClick={() => canExpand && setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={expanded ? "Collapse group" : "Expand group"}
          disabled={!canExpand}
          className={`p-1 rounded flex-shrink-0 ${
            canExpand
              ? "text-gray-500 hover:text-gray-200 cursor-pointer"
              : "text-transparent"
          }`}
        >
          <ChevronRight
            className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-90" : ""}`}
          />
        </button>

        <div
          className={`flex items-center gap-4 flex-1 min-w-0 ${
            onRowActivate ? "cursor-pointer" : ""
          }`}
          onClick={onRowActivate}
        >
          <div className="w-16 text-[11px] text-gray-500 font-mono flex-shrink-0 text-right">
            {formatTime(group.firstAt)}
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            {statusSequence.map((status, i) => (
              <div key={i} className="flex items-center gap-1">
                {i > 0 && <span className="text-gray-600 text-[10px]">→</span>}
                <AgentStatusBadge status={status} />
              </div>
            ))}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-300 truncate">
              {group.summary || group.events[0]?.event_type || ""}
            </p>
          </div>

          {group.tool_name && (
            <span className="text-[11px] px-2 py-0.5 bg-surface-2 rounded text-gray-500 font-mono flex-shrink-0">
              {group.tool_name}
            </span>
          )}

          {duration && (
            <span className="text-[11px] text-gray-500 font-mono flex-shrink-0">{duration}</span>
          )}

          <span className="text-[11px] text-gray-600 flex-shrink-0 w-16 text-right">
            {timeAgo(group.firstAt)}
          </span>
        </div>
      </div>

      {expanded && (
        <div className="bg-surface-2/40 border-t border-border divide-y divide-border">
          <div className="px-5 py-1.5 text-[10px] text-gray-600 uppercase tracking-wide">
            {t("eventFilters.groupEventCount", { count: group.events.length })}
          </div>
          {group.events.map((event) => (
            <div
              key={event.id}
              className="px-5 py-2 flex items-center gap-4 min-w-0"
            >
              <div className="w-16 text-[11px] text-gray-600 font-mono flex-shrink-0 text-right">
                {formatTime(event.created_at)}
              </div>
              <AgentStatusBadge status={statusFromEventType(event.event_type)} />
              <span className="text-[11px] text-gray-500 font-mono flex-shrink-0">
                {event.event_type}
              </span>
              <span className="text-[11px] text-gray-400 flex-1 truncate">
                {event.summary || ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function dedupeConsecutive<T>(arr: T[]): T[] {
  const out: T[] = [];
  for (const item of arr) {
    if (out.length === 0 || out[out.length - 1] !== item) out.push(item);
  }
  return out;
}
