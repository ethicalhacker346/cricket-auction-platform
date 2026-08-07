import { useEffect, useState } from "react";
import type { Franchise, Player } from "@/features/auction/types/index.types";
import { ROLE_ICONS } from "@/features/auction/constants/index.constants";
import { formatLakhs, initials } from "@/features/auction/utils/index.utils";

/* =============================================================================
   SQUAD PDF TEMPLATE
   ─────────────────────────────────────────────────────────────────────────────
   • Zero Tailwind classes (no className anywhere).
   • Only explicit hex / rgb / hsl inline styles.
   • Rendered inside an iframe so parent CSS (oklch, etc.) can never leak.
   • Player avatars attempt profileImage with CORS; fall back to initials.
   ============================================================================= */

interface SquadPDFTemplateProps {
  franchise: Franchise;
  players: Player[];
  onRender?: () => void;
}

function PDFAvatar({ player }: { player: Player }) {
  const [failed, setFailed] = useState(!player.profileImage);

  useEffect(() => {
    setFailed(!player.profileImage);
  }, [player.profileImage]);

  if (!failed && player.profileImage) {
    return (
      <img
        src={player.profileImage}
        alt=""
        crossOrigin="anonymous"
        onError={() => setFailed(true)}
        style={{
          width: "32px",
          height: "32px",
          borderRadius: "8px",
          objectFit: "cover",
          display: "block",
          flexShrink: 0,
        }}
      />
    );
  }

  // Fallback gradient initials
  const seed = player.name;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const hue1 = h % 360;
  const hue2 = (h + 40) % 360;

  return (
    <div
      style={{
        width: "32px",
        height: "32px",
        borderRadius: "8px",
        overflow: "hidden",
        background: `linear-gradient(135deg, hsl(${hue1} 55% 32%), hsl(${hue2} 55% 16%))`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontSize: "10px",
        fontWeight: 800,
        flexShrink: 0,
      }}
    >
      {initials(player.name)}
    </div>
  );
}

export function SquadPDFTemplate({
  franchise,
  players,
  onRender,
}: SquadPDFTemplateProps) {
  useEffect(() => {
    const t = setTimeout(() => onRender?.(), 200);
    return () => clearTimeout(t);
  }, [onRender]);

  const squadIds = new Set(franchise.squad ?? []);
  const squad = (players ?? []).filter((p) => squadIds.has(p.id));

  // ── Case-insensitive role counting with aliases ──
  const normalizeRole = (role?: string) => role?.trim().toLowerCase() ?? "";
  const composition = {
    batters: squad.filter((p) => {
      const r = normalizeRole(p.role);
      return r === "batter" || r === "batsman";
    }).length,
    bowlers: squad.filter((p) => normalizeRole(p.role) === "bowler").length,
    allRounders: squad.filter((p) => {
      const r = normalizeRole(p.role);
      return r === "all-rounder" || r === "allrounder";
    }).length,
    wicketKeepers: squad.filter((p) => {
      const r = normalizeRole(p.role);
      return r === "wicket-keeper" || r === "wicketkeeper";
    }).length,
  };

  const overseasCount = squad.filter((p) => p.overseas).length;
  const reserved = franchise.reservedBudget ?? 0;
  const remaining = franchise.purseTotal - franchise.spent - reserved;

  const topSign = squad.reduce<Player | null>((top, p) => {
    if (p.soldPrice == null) return top;
    return top == null || (top.soldPrice ?? 0) < p.soldPrice ? p : top;
  }, null);

  const brandGradient = `linear-gradient(135deg, ${franchise.colorFrom}, ${franchise.colorTo})`;
  const PLATFORM_WATERMARK = "/landingimage.png"; // public/logo.png

  // ── Style tokens (hex only) ──
  const S: Record<string, React.CSSProperties> = {
    page: {
      width: "794px",
      minHeight: "1123px",      // A4
      position: "relative",
      overflow: "hidden",

      padding: "40px",

      background: "#ffffff",

      color: "#0f172a",

      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    },

    watermark: {
      position: "absolute",

      left: "50%",
      top: "50%",

      transform: "translate(-50%, -50%)",

      width: "620px",
      height: "620px",

      display: "flex",
      alignItems: "center",
      justifyContent: "center",

      opacity: 0.15,

      zIndex: 0,

      pointerEvents: "none",

      userSelect: "none",
    },

    header: {
      display: "flex",
      alignItems: "center",
      gap: "24px",
      marginBottom: "28px",
      paddingBottom: "28px",
      borderBottom: "3px solid #f1f5f9",
    },
    logoWrap: {
      width: "80px",
      height: "80px",
      borderRadius: "20px",
      overflow: "hidden",
      background: brandGradient,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#fff",
      fontSize: "28px",
      fontWeight: 900,
      flexShrink: 0,
    },
    title: { margin: 0, fontSize: "32px", fontWeight: 900, letterSpacing: "-0.02em" },
    subtitle: { margin: "6px 0 0", fontSize: "14px", color: "#64748b" },
    badge: {
      textAlign: "right",
      padding: "12px 20px",
      borderRadius: "16px",
      background: "#f8fafc",
      border: "2px solid #e2e8f0",
    },
    badgeLabel: {
      margin: 0,
      fontSize: "11px",
      fontWeight: 700,
      color: "#94a3b8",
      textTransform: "uppercase",
      letterSpacing: "0.1em",
    },
    badgeValue: { margin: "4px 0 0", fontSize: "24px", fontWeight: 900, color: "#0f172a" },
    grid3: {
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: "16px",
      marginBottom: "24px",
    },
    grid4: {
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: "12px",
      marginBottom: "28px",
    },
    card: {
      padding: "20px",
      borderRadius: "16px",
      background: "#f8fafc",
      border: "2px solid #f1f5f9",
      textAlign: "center",
    },
    cardLabel: {
      margin: "6px 0 0",
      fontSize: "10px",
      fontWeight: 700,
      color: "#94a3b8",
      textTransform: "uppercase",
      letterSpacing: "0.12em",
    },
    compCard: {
      padding: "16px",
      borderRadius: "14px",
      background: brandGradient,
      color: "#fff",
      textAlign: "center",
    },
    compValue: { margin: 0, fontSize: "22px", fontWeight: 900 },
    compLabel: {
      margin: "4px 0 0",
      fontSize: "10px",
      fontWeight: 700,
      opacity: 0.9,
      textTransform: "uppercase",
      letterSpacing: "0.08em",
    },
    row2: { display: "flex", gap: "12px", marginBottom: "28px" },
    sectionTitle: {
      margin: "0 0 12px",
      fontSize: "11px",
      fontWeight: 800,
      color: "#94a3b8",
      textTransform: "uppercase",
      letterSpacing: "0.15em",
    },
    table: { width: "100%", borderCollapse: "separate", borderSpacing: "0 8px" },
    th: {
      textAlign: "left",
      padding: "10px 12px",
      fontSize: "10px",
      fontWeight: 800,
      color: "#64748b",
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      background: "#f8fafc",
      borderBottom: "2px solid #e2e8f0",
    },
    td: { padding: "12px", fontSize: "12px", fontWeight: 700, color: "#475569" },
    tdMuted: { padding: "12px", fontSize: "11px", color: "#64748b" },
    tdPrice: { padding: "12px", fontSize: "13px", fontWeight: 900, color: "#d97706" },
    tdIndex: { padding: "12px", fontSize: "12px", fontWeight: 700, color: "#94a3b8" },
    overseasBadge: {
      fontSize: "9px",
      fontWeight: 700,
      color: "#2563eb",
      background: "#dbeafe",
      padding: "1px 6px",
      borderRadius: "4px",
    },
    empty: {
      textAlign: "center",
      padding: "40px",
      color: "#94a3b8",
      fontSize: "14px",
      fontWeight: 600,
    },
    footer: {
      marginTop: "32px",
      paddingTop: "20px",
      borderTop: "2px solid #f1f5f9",
      textAlign: "center",
      fontSize: "10px",
      fontWeight: 700,
      color: "#cbd5e1",
      textTransform: "uppercase",
      letterSpacing: "0.1em",
    },
  };

  const infoCard = (bg: string, border: string): React.CSSProperties => ({
    flex: 1,
    padding: "14px 18px",
    borderRadius: "12px",
    background: bg,
    border: `2px solid ${border}`,
    display: "flex",
    alignItems: "center",
    gap: "10px",
  });

  const infoTitle = (c: string): React.CSSProperties => ({
    margin: 0,
    fontSize: "12px",
    fontWeight: 800,
    color: c,
  });

  const infoValue = (c: string): React.CSSProperties => ({
    margin: "2px 0 0",
    fontSize: "14px",
    fontWeight: 700,
    color: c,
  });

  const cardValue = (c: string): React.CSSProperties => ({
    margin: 0,
    fontSize: "20px",
    fontWeight: 900,
    color: c,
  });

  const trStyle = (idx: number): React.CSSProperties => ({
    background: idx % 2 === 0 ? "#ffffff" : "#f8fafc",
    borderRadius: "10px",
    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
  });

  return (
    <div style={S.page}>
      <div style={S.watermark}>
        <img
            src={PLATFORM_WATERMARK}
            alt=""
            crossOrigin="anonymous"
            style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                display: "block",
            }}
        />
      </div>
      <div
        style={{
            position: "relative",
            zIndex: 1,
        }}
      >
      {/* ── Header ── */}
      <div style={S.header}>
        <div style={S.logoWrap}>
          {franchise.logo ? (
            <img
              src={franchise.logo}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              crossOrigin="anonymous"
            />
          ) : (
            initials(franchise.shortName)
          )}
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={S.title}>{franchise.name}</h1>
          <p style={S.subtitle}>
            Owner: <strong>{franchise.owner}</strong>
            {franchise.city ? ` · ${franchise.city}` : ""} · Season 2026
          </p>
        </div>
        <div style={S.badge}>
          <p style={S.badgeLabel}>Squad Size</p>
          <p style={S.badgeValue}>
            {squad.length}{" "}
            <span style={{ fontSize: "14px", color: "#94a3b8" }}>
              / {franchise.maxSquadSize}
            </span>
          </p>
        </div>
      </div>

      {/* ── Budget ── */}
      <div style={S.grid3}>
        {[
          { label: "Total Purse", value: formatLakhs(franchise.purseTotal), color: "#0f172a" },
          { label: "Spent", value: formatLakhs(franchise.spent), color: "#e11d48" },
          { label: "Remaining", value: formatLakhs(remaining), color: remaining < 0 ? "#e11d48" : "#059669" },
        ].map((item) => (
          <div key={item.label} style={S.card}>
            <p style={cardValue(item.color)}>{item.value}</p>
            <p style={S.cardLabel}>{item.label}</p>
          </div>
        ))}
      </div>

      {/* ── Composition ── */}
      <div style={S.grid4}>
        {[
          { icon: "🏏", label: "Batters", count: composition.batters },
          { icon: "🎯", label: "Bowlers", count: composition.bowlers },
          { icon: "⚡", label: "All-Rounders", count: composition.allRounders },
          { icon: "🧤", label: "Wicket Keepers", count: composition.wicketKeepers },
        ].map((c) => (
          <div key={c.label} style={S.compCard}>
            <p style={S.compValue}>{c.count}</p>
            <p style={S.compLabel}>
              {c.icon} {c.label}
            </p>
          </div>
        ))}
      </div>

      {/* ── Overseas & Top Buy ── */}
      <div style={S.row2}>
        <div style={infoCard("#eff6ff", "#dbeafe")}>
          <span style={{ fontSize: "20px" }}>🌏</span>
          <div>
            <p style={infoTitle("#1e40af")}>Overseas Slots</p>
            <p style={infoValue("#1d4ed8")}>
              {overseasCount} / {franchise.maxOverseas}
            </p>
          </div>
        </div>
        {topSign && (
          <div style={infoCard("#fffbeb", "#fef3c7")}>
            <span style={{ fontSize: "20px" }}>👑</span>
            <div>
              <p style={infoTitle("#92400e")}>Top Signing</p>
              <p style={infoValue("#b45309")}>
                {topSign.name} · {formatLakhs(topSign.soldPrice ?? 0)}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Squad Table ── */}
      <p style={S.sectionTitle}>Full Squad</p>
      <table style={S.table}>
        <thead>
          <tr>
            {["#", "Player", "Role", "Batting", "Bowling", "Age", "Price"].map((h) => (
              <th key={h} style={S.th}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {squad.map((p, idx) => (
            <tr key={p.id} style={trStyle(idx)}>
              <td style={{ ...S.tdIndex, borderRadius: "10px 0 0 10px" }}>
                {idx + 1}
              </td>
              <td style={S.td}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <PDFAvatar player={p} />
                  <div>
                    <p style={{ margin: 0, fontSize: "13px", fontWeight: 800, color: "#0f172a" }}>
                      {p.name}
                    </p>
                    {p.overseas && <span style={S.overseasBadge}>Overseas</span>}
                  </div>
                </div>
              </td>
              <td style={S.td}>
                {ROLE_ICONS[p.role] ?? "🏏"} {p.role}
              </td>
              <td style={S.tdMuted}>{p.battingStyle ?? "—"}</td>
              <td style={S.tdMuted}>{p.bowlingStyle ?? "—"}</td>
              <td style={S.td}>{p.age || "—"}</td>
              <td style={{ ...S.tdPrice, borderRadius: "0 10px 10px 0" }}>
                {formatLakhs(p.soldPrice ?? 0)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {squad.length === 0 && <div style={S.empty}>No players acquired yet.</div>}

      <div style={S.footer}>
        Generated{" "}
        {new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
      </div>
      </div>
    </div>
  );
}