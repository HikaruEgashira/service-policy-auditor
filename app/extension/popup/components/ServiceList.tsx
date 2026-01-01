import type { DetectedService } from "@ai-service-exposure/core";

interface Props {
  services: DetectedService[];
}

export function ServiceList({ services }: Props) {
  if (services.length === 0) {
    return (
      <div style={styles.empty}>
        <p style={styles.emptyTitle}>No services detected</p>
        <p style={styles.emptyHint}>
          Browse the web to detect login pages and privacy policies.
        </p>
      </div>
    );
  }

  const sorted = [...services].sort((a, b) => b.detectedAt - a.detectedAt);

  return (
    <div style={styles.list}>
      {sorted.map((service, i) => (
        <ServiceCard key={service.domain} service={service} isLast={i === sorted.length - 1} />
      ))}
    </div>
  );
}

function ServiceCard({ service, isLast }: { service: DetectedService; isLast: boolean }) {
  return (
    <div style={{ ...styles.card, ...(isLast ? {} : styles.cardBorder) }}>
      <div style={styles.cardHeader}>
        <span style={styles.domain}>{service.domain}</span>
        <div style={styles.tags}>
          {service.hasLoginPage && <span style={styles.tag}>login</span>}
          {service.privacyPolicyUrl && <span style={styles.tag}>privacy</span>}
          {service.cookies.length > 0 && (
            <span style={styles.tag}>{service.cookies.length} cookies</span>
          )}
        </div>
      </div>

      {service.cookies.length > 0 && (
        <div style={styles.cookies}>
          {service.cookies.map((c) => c.name).join(", ")}
        </div>
      )}

      {service.privacyPolicyUrl && (
        <a
          href={service.privacyPolicyUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={styles.link}
        >
          Privacy Policy ↗
        </a>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  list: {
    padding: "4px 0",
  },
  empty: {
    textAlign: "center",
    padding: "48px 20px",
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
  card: {
    padding: "12px 8px",
  },
  cardBorder: {
    borderBottom: "1px solid hsl(0 0% 92%)",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
  },
  domain: {
    fontWeight: 500,
    fontSize: "14px",
    color: "hsl(0 0% 10%)",
  },
  tags: {
    display: "flex",
    gap: "6px",
    flexShrink: 0,
  },
  tag: {
    fontSize: "11px",
    color: "hsl(0 0% 50%)",
  },
  cookies: {
    fontSize: "12px",
    color: "hsl(0 0% 45%)",
    marginTop: "6px",
    fontFamily: "ui-monospace, monospace",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  link: {
    fontSize: "12px",
    color: "hsl(0 0% 40%)",
    textDecoration: "none",
    marginTop: "6px",
    display: "inline-block",
  },
};
