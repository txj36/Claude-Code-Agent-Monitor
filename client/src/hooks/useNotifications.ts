import { useEffect } from "react";
import i18n from "../i18n";
import { eventBus } from "../lib/eventBus";
import type { WSMessage, Session, Agent, DashboardEvent } from "../lib/types";

const NOTIF_KEY = "agent-monitor-notifications";

interface NotifPrefs {
  enabled: boolean;
  onNewSession: boolean;
  onSessionError: boolean;
  onSessionComplete: boolean;
  onSubagentSpawn: boolean;
}

function loadPrefs(): NotifPrefs {
  try {
    const raw = localStorage.getItem(NOTIF_KEY);
    if (!raw)
      return {
        enabled: false,
        onNewSession: true,
        onSessionError: true,
        onSessionComplete: false,
        onSubagentSpawn: false,
      };
    return {
      enabled: false,
      onNewSession: true,
      onSessionError: true,
      onSessionComplete: false,
      onSubagentSpawn: false,
      ...JSON.parse(raw),
    };
  } catch {
    return {
      enabled: false,
      onNewSession: true,
      onSessionError: true,
      onSessionComplete: false,
      onSubagentSpawn: false,
    };
  }
}

function notify(title: string, body: string) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, icon: "/favicon.ico" });
  } catch {
    // Safari/mobile may not support Notification constructor
  }
}

export function useNotifications() {
  useEffect(() => {
    return eventBus.subscribe((msg: WSMessage) => {
      const prefs = loadPrefs();
      if (!prefs.enabled) return;

      switch (msg.type) {
        case "session_created": {
          if (!prefs.onNewSession) return;
          const s = msg.data as Session;
          notify(i18n.t("errors:notifications.newSession"), s.name || `${i18n.t("errors:notifications.sessionDefault")}${s.id.slice(0, 8)}`);
          break;
        }
        case "session_updated": {
          const s = msg.data as Session;
          if (s.status === "error" && prefs.onSessionError) {
            notify(i18n.t("errors:notifications.sessionError"), s.name || `${i18n.t("errors:notifications.sessionDefault")}${s.id.slice(0, 8)}`);
          }
          break;
        }
        case "agent_created": {
          if (!prefs.onSubagentSpawn) return;
          const a = msg.data as Agent;
          if (a.type === "subagent") {
            notify(i18n.t("errors:notifications.subagentSpawned"), a.name);
          }
          break;
        }
        case "new_event": {
          const ev = msg.data as DashboardEvent;
          if (ev.event_type === "Stop" && prefs.onSessionComplete) {
            notify(i18n.t("errors:notifications.finishedResponding"), ev.summary || i18n.t("errors:notifications.readyForInput"));
          } else if (ev.event_type === "SessionEnd" && prefs.onSessionComplete) {
            notify(i18n.t("errors:notifications.sessionCompleted"), ev.summary || i18n.t("errors:notifications.sessionClosed"));
          } else if (ev.event_type === "Notification") {
            notify(i18n.t("errors:notifications.defaultTitle"), ev.summary || i18n.t("errors:notifications.defaultBody"));
          }
          break;
        }
      }
    });
  }, []);
}
