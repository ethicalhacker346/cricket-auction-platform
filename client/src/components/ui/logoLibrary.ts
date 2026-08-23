export type LogoCategory = "player" | "franchise" | "tournament";

export interface Logo {
  id: string;
  url: string;
  name: string;
  category: LogoCategory;
}

// ============================================================================
// PUBLIC LOGO LIBRARY
// ============================================================================
// Drop new PNGs into public/logos/<category>/ and add one line here. Done.
// No component changes. No backend. No uploads.
// ============================================================================

export const LOGO_LIBRARY: Logo[] = [
  // ─── PLAYER LOGOS ─────────────────────────────────────────────────────────
  {
    id: "p-1",
    url: "/logos/players/image1.png",
    name: "Cyber Wolf",
    category: "player",
  },
  {
    id: "p-2",
    url: "/logos/players/image2.png",
    name: "Neon Phantom",
    category: "player",
  },
  {
    id: "p-3",
    url: "/logos/players/image3.png",
    name: "Void Striker",
    category: "player",
  },
  {
    id: "p-4",
    url: "/logos/players/image4.png",
    name: "ms dhoni",
    category: "player",
  },
  {
    id: "p-5",
    url: "/logos/players/image5.png",
    name: "Ghost Recon",
    category: "player",
  },
  {
    id: "p-6",
    url: "/logos/players/image6.png",
    name: "Venom Strike",
    category: "player",
  },
  {
    id: "p-7",
    url: "/logos/players/image7.png",
    name: "virat kohli",
    category: "player",
  },
  {
    id: "p-8",
    url: "/logos/players/image8.png",
    name: "Frost Bite",
    category: "player",
  },
  {
    id: "p-9",
    url: "/logos/players/image9.png",
    name: "Frost Bite",
    category: "player",
  },
  {
    id: "p-10",
    url: "/logos/players/image10.png",
    name: "Frost Bite",
    category: "player",
  },

  // ─── FRANCHISE LOGOS ──────────────────────────────────────────────────────
  {
    id: "f-1",
    url: "/logos/franchises/image1.png",
    name: "Apex Legion",
    category: "franchise",
  },
  {
    id: "f-2",
    url: "/logos/franchises/image2.png",
    name: "Titan Core",
    category: "franchise",
  },
  {
    id: "f-3",
    url: "/logos/franchises/image3.png",
    name: "Nova Syndicate",
    category: "franchise",
  },
  {
    id: "f-4",
    url: "/logos/franchises/image4.png",
    name: "Guardian Core",
    category: "franchise",
  },
  {
    id: "f-5",
    url: "/logos/franchises/image5.png",
    name: "Inferno Squad",
    category: "franchise",
  },
  {
    id: "f-6",
    url: "/logos/franchises/image6.png",
    name: "Dynamo Elite",
    category: "franchise",
  },

  // ─── TOURNAMENT LOGOS ─────────────────────────────────────────────────────
  {
    id: "t-1",
    url: "/logos/tournaments/image1.png",
    name: "Championship Cup",
    category: "tournament",
  },
  {
    id: "t-2",
    url: "/logos/tournaments/image2.png",
    name: "Grand Masters",
    category: "tournament",
  },
  {
    id: "t-3",
    url: "/logos/tournaments/image3.png",
    name: "Legend Series",
    category: "tournament",
  },
  {
    id: "t-4",
    url: "/logos/tournaments/image4.png",
    name: "World Open",
    category: "tournament",
  },
  {
    id: "t-5",
    url: "/logos/tournaments/image5.png",
    name: "strikers club",
    category: "tournament",
  },
];

/** Get logos filtered by category */
export function getLogosByCategory(category: LogoCategory): Logo[] {
  return LOGO_LIBRARY.filter((logo) => logo.category === category);
}

/** Get all logos for a given user role */
export function getLogosForRole(
  role: "player" | "franchise_owner" | "organizer" | "admin"
): Logo[] {
  if (role === "admin") return LOGO_LIBRARY;
  const map: Record<string, LogoCategory> = {
    player: "player",
    franchise_owner: "franchise",
    organizer: "tournament",
  };
  return getLogosByCategory(map[role]);
}