import type { EventLog } from "@ai-service-exposure/core";

interface Props {
  events: EventLog[];
}

const EVENT_LABELS: Record<EventLog["type"], string> = {
  login_detected: "login",
  privacy_policy_found: "privacy",
  cookie_set: "cookie",
};

export function EventLogList({ events }: Props) {
  if (events.length === 0) {
    return (
      <div style={styles.empty}>
        <p style={styles.emptyTitle}>No events recorded</p>
        <p style={styles.emptyHint}>Events will appear as you browse.</p>
      </div>
    );
  }

  return (
    <div style={styles.list}>
      {events.slice(0, 50).map((event) => (
        <EventItem key={event.id} event={event} />
      ))}
    </div>
  );
}

function EventItem({ event }: { event: EventLog }) {
  const time = new Date(event.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const detail =
    event.type === "cookie_set" && event.details.name
      ? String(event.details.name)
      : null;

  return (
    <div style={styles.item}>
      <span style={styles.time}>{time}</span>
      <span style={styles.type}>{EVENT_LABELS[event.type]}</span>
      <span style={styles.domain}>{event.domain}</span>
      {detail && <span style={styles.detail}>{detail}</span>}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  list: {
    padding: "4px 0",
    fontFamily: "ui-monospace, monospace",
    fontSize: "12px",
  },
  empty: {
    textAlign: "center",
    padding: "48px 20px",
    fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
  },
  emptyTitle: {
    fontSize: "14px",
    fontWeight: 500,
    color: "hsl(0 0% 20%)",
  },
  emptyHint: {
    fontSize: "13px",
    marginTop: "4px",
    color: "hsl(0 0% 50%)",
  },
  item: {
    display: "flex",
    gap: "12px",
    padding: "6px 8px",
    color: "hsl(0 0% 35%)",
  },
  time: {
    color: "hsl(0 0% 60%)",
    flexShrink: 0,
  },
  type: {
    color: "hsl(0 0% 50%)",
    width: "52px",
    flexShrink: 0,
  },
  domain: {
    color: "hsl(0 0% 20%)",
    flexShrink: 0,
  },
  detail: {
    color: "hsl(0 0% 55%)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
};
