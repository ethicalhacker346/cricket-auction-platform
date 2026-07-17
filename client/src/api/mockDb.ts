import type { TournamentStatus, TeamStatus, PlayerRole, PlayerRegistrationStatus } from "@/types/tournament";

export interface TournamentRecord {
  id: string;
  name: string;
  slug: string;
  description?: string;
  organizerId: string;
  organizerName: string;
  status: TournamentStatus;
  season?: string;
  venue?: string;
  playerRegistrationOpen: boolean;
  teamRegistrationOpen: boolean;
  registrationDeadline?: string;
  auctionDate?: string;
  maxTeams: number;
  squadSize: number;
  defaultPurse: number;
  minBidIncrement: number;
  lotTimerSeconds: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface TeamRecord {
  id: string;
  tournamentId: string;
  ownerId: string;
  ownerName: string;
  name: string;
  shortCode: string;
  city?: string;
  contactEmail: string;
  contactPhone?: string;
  brandColor: string;
  purse: number;
  status: TeamStatus;
  createdAt: string;
}

export interface PlayerRecord {
  id: string;
  tournamentId: string;
  userId: string;
  name: string;
  role: PlayerRole;
  battingStyle?: string;
  bowlingStyle?: string;
  basePrice: number;
  contactPhone?: string;
  experienceYears?: number;
  status: PlayerRegistrationStatus;
  createdAt: string;
}

interface Db {
  tournaments: TournamentRecord[];
  teams: TeamRecord[];
  players: PlayerRecord[];
}

const STORAGE_KEY = "gullybid.mockdb.v2";

export const DEMO_USERS = {
  ORGANIZER: { id: "user-organizer-1", name: "Rahul Sharma" },
  ORGANIZER_2: { id: "user-organizer-2", name: "Priya Nair" },
  FRANCHISE: { id: "user-franchise-1", name: "Vikram Singh" },
  PLAYER: { id: "user-player-1", name: "Arjun Mehta" },
  ADMIN: { id: "user-admin-1", name: "Ananya Rao" },
};

function iso(daysFromNow: number) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString();
}

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function seed(): Db {
  const tournaments: TournamentRecord[] = [
    {
      id: "t-mumbai-gpl",
      name: "Mumbai Gully Premier League 2026",
      slug: "mumbai-gully-premier-league-2026",
      description:
        "The flagship street-cricket auction tournament of Mumbai. 8 franchises battle it out after a fiercely contested player auction.",
      organizerId: DEMO_USERS.ORGANIZER.id,
      organizerName: DEMO_USERS.ORGANIZER.name,
      status: "REGISTRATION_OPEN",
      season: "Season 4",
      venue: "Shivaji Park Turf, Mumbai",
      playerRegistrationOpen: true,
      teamRegistrationOpen: true,
      registrationDeadline: iso(12),
      auctionDate: iso(20),
      maxTeams: 8,
      squadSize: 15,
      defaultPurse: 10_000_000,
      minBidIncrement: 50_000,
      lotTimerSeconds: 30,
      currency: "INR",
      createdAt: iso(-10),
      updatedAt: iso(-1),
    },
    {
      id: "t-delhi-scc",
      name: "Delhi Street Cricket Championship",
      slug: "delhi-street-cricket-championship",
      description: "Delhi's most competitive tapeball auction league, live right now with 8 franchises battling for 96 registered players.",
      organizerId: DEMO_USERS.ORGANIZER_2.id,
      organizerName: DEMO_USERS.ORGANIZER_2.name,
      status: "AUCTION_LIVE",
      season: "Season 2",
      venue: "Jawaharlal Nehru Stadium Nets, Delhi",
      playerRegistrationOpen: false,
      teamRegistrationOpen: false,
      registrationDeadline: iso(-3),
      auctionDate: iso(0),
      maxTeams: 8,
      squadSize: 14,
      defaultPurse: 8_000_000,
      minBidIncrement: 25_000,
      lotTimerSeconds: 25,
      currency: "INR",
      createdAt: iso(-30),
      updatedAt: iso(0),
    },
    {
      id: "t-bengaluru-bcc",
      name: "Bengaluru Box Cricket Cup",
      slug: "bengaluru-box-cricket-cup",
      description: "A fast-paced indoor box-cricket auction tournament, still being finalized before it opens for registrations.",
      organizerId: DEMO_USERS.ORGANIZER.id,
      organizerName: DEMO_USERS.ORGANIZER.name,
      status: "DRAFT",
      season: "Season 1",
      venue: "Indiranagar Sports Arena, Bengaluru",
      playerRegistrationOpen: false,
      teamRegistrationOpen: false,
      registrationDeadline: iso(25),
      auctionDate: iso(35),
      maxTeams: 6,
      squadSize: 12,
      defaultPurse: 6_000_000,
      minBidIncrement: 20_000,
      lotTimerSeconds: 30,
      currency: "INR",
      createdAt: iso(-2),
      updatedAt: iso(-2),
    },
    {
      id: "t-chennai-sgt",
      name: "Chennai Super Gully Trophy",
      slug: "chennai-super-gully-trophy",
      description: "Registrations have closed — franchises and players are locked in ahead of auction day.",
      organizerId: DEMO_USERS.ORGANIZER_2.id,
      organizerName: DEMO_USERS.ORGANIZER_2.name,
      status: "REGISTRATION_CLOSED",
      season: "Season 3",
      venue: "Marina Turf Ground, Chennai",
      playerRegistrationOpen: false,
      teamRegistrationOpen: false,
      registrationDeadline: iso(-1),
      auctionDate: iso(6),
      maxTeams: 8,
      squadSize: 15,
      defaultPurse: 9_000_000,
      minBidIncrement: 50_000,
      lotTimerSeconds: 30,
      currency: "INR",
      createdAt: iso(-20),
      updatedAt: iso(-1),
    },
    {
      id: "t-pune-wwl",
      name: "Pune Weekend Warriors League",
      slug: "pune-weekend-warriors-league",
      description: "A wrapped-up season with the trophy already lifted. Browse the final rosters and results.",
      organizerId: DEMO_USERS.ORGANIZER.id,
      organizerName: DEMO_USERS.ORGANIZER.name,
      status: "COMPLETED",
      season: "Season 2",
      venue: "Balewadi Sports Complex, Pune",
      playerRegistrationOpen: false,
      teamRegistrationOpen: false,
      registrationDeadline: iso(-60),
      auctionDate: iso(-50),
      maxTeams: 6,
      squadSize: 13,
      defaultPurse: 7_000_000,
      minBidIncrement: 25_000,
      lotTimerSeconds: 30,
      currency: "INR",
      createdAt: iso(-90),
      updatedAt: iso(-45),
    },
    {
      id: "t-hyderabad-ttb",
      name: "Hyderabad Tapeball Bash",
      slug: "hyderabad-tapeball-bash",
      description: "This edition was cancelled due to low franchise turnout.",
      organizerId: DEMO_USERS.ORGANIZER_2.id,
      organizerName: DEMO_USERS.ORGANIZER_2.name,
      status: "CANCELLED",
      season: "Season 1",
      venue: "Gachibowli Grounds, Hyderabad",
      playerRegistrationOpen: false,
      teamRegistrationOpen: false,
      registrationDeadline: iso(-40),
      auctionDate: iso(-30),
      maxTeams: 8,
      squadSize: 15,
      defaultPurse: 8_000_000,
      minBidIncrement: 50_000,
      lotTimerSeconds: 30,
      currency: "INR",
      createdAt: iso(-70),
      updatedAt: iso(-38),
    },
    {
      id: "t-kolkata-mm",
      name: "Kolkata Maidan Masters",
      slug: "kolkata-maidan-masters",
      description: "The auction is temporarily paused for a lunch break — bidding resumes shortly.",
      organizerId: DEMO_USERS.ORGANIZER.id,
      organizerName: DEMO_USERS.ORGANIZER.name,
      status: "AUCTION_PAUSED",
      season: "Season 5",
      venue: "Eden Maidan Nets, Kolkata",
      playerRegistrationOpen: false,
      teamRegistrationOpen: false,
      registrationDeadline: iso(-5),
      auctionDate: iso(0),
      maxTeams: 8,
      squadSize: 15,
      defaultPurse: 10_000_000,
      minBidIncrement: 50_000,
      lotTimerSeconds: 30,
      currency: "INR",
      createdAt: iso(-15),
      updatedAt: iso(0),
    },
  ];

  const teams: TeamRecord[] = [
    {
      id: uid("team"),
      tournamentId: "t-mumbai-gpl",
      ownerId: DEMO_USERS.FRANCHISE.id,
      ownerName: DEMO_USERS.FRANCHISE.name,
      name: "Andheri Avengers",
      shortCode: "AVN",
      city: "Mumbai",
      contactEmail: "vikram@andheriavengers.in",
      contactPhone: "9876543210",
      brandColor: "#f97316",
      purse: 10_000_000,
      status: "APPROVED",
      createdAt: iso(-6),
    },
    {
      id: uid("team"),
      tournamentId: "t-mumbai-gpl",
      ownerId: "user-franchise-2",
      ownerName: "Sanjay Kulkarni",
      name: "Dadar Dynamos",
      shortCode: "DYN",
      city: "Mumbai",
      contactEmail: "sanjay@dadardynamos.in",
      brandColor: "#0ea5e9",
      purse: 10_000_000,
      status: "PENDING",
      createdAt: iso(-4),
    },
    {
      id: uid("team"),
      tournamentId: "t-mumbai-gpl",
      ownerId: "user-franchise-3",
      ownerName: "Meera Joshi",
      name: "Bandra Blasters",
      shortCode: "BLB",
      city: "Mumbai",
      contactEmail: "meera@bandrablasters.in",
      brandColor: "#a855f7",
      purse: 10_000_000,
      status: "PENDING",
      createdAt: iso(-2),
    },
    ...Array.from({ length: 8 }).map((_, i) =>
      i === 0
        ? {
            id: uid("team"),
            tournamentId: "t-delhi-scc",
            ownerId: DEMO_USERS.FRANCHISE.id,
            ownerName: DEMO_USERS.FRANCHISE.name,
            name: "Saket Strikers",
            shortCode: "SKS",
            city: "Delhi",
            contactEmail: "vikram@saketstrikers.in",
            brandColor: "#f97316",
            purse: 8_000_000,
            status: "APPROVED" as TeamStatus,
            createdAt: iso(-25),
          }
        : {
            id: uid("team"),
            tournamentId: "t-delhi-scc",
            ownerId: `user-franchise-d${i}`,
            ownerName: `Owner ${i + 1}`,
            name: `Delhi Franchise ${i + 1}`,
            shortCode: `DF${i + 1}`,
            city: "Delhi",
            contactEmail: `owner${i + 1}@delhi.in`,
            brandColor: ["#0ea5e9", "#22c55e", "#a855f7", "#eab308", "#ef4444", "#14b8a6", "#6366f1"][i % 7],
            purse: 8_000_000,
            status: "APPROVED" as TeamStatus,
            createdAt: iso(-25),
          }
    ),
    {
      id: uid("team"),
      tournamentId: "t-pune-wwl",
      ownerId: DEMO_USERS.FRANCHISE.id,
      ownerName: DEMO_USERS.FRANCHISE.name,
      name: "Kothrud Kings",
      shortCode: "KTK",
      city: "Pune",
      contactEmail: "vikram@kothrudkings.in",
      brandColor: "#f97316",
      purse: 7_000_000,
      status: "APPROVED",
      createdAt: iso(-85),
    },
  ];

  const roles: PlayerRole[] = ["BATSMAN", "BOWLER", "ALL_ROUNDER", "WICKET_KEEPER"];
  const players: PlayerRecord[] = [
    {
      id: uid("plyr"),
      tournamentId: "t-mumbai-gpl",
      userId: DEMO_USERS.PLAYER.id,
      name: DEMO_USERS.PLAYER.name,
      role: "ALL_ROUNDER",
      battingStyle: "Right-hand bat",
      bowlingStyle: "Right-arm medium",
      basePrice: 200_000,
      contactPhone: "9988776655",
      experienceYears: 6,
      status: "REGISTERED",
      createdAt: iso(-5),
    },
    ...Array.from({ length: 41 }).map((_, i) => ({
      id: uid("plyr"),
      tournamentId: "t-mumbai-gpl",
      userId: `user-player-${i + 10}`,
      name: `Player ${i + 2}`,
      role: roles[i % roles.length],
      basePrice: 100_000 + (i % 5) * 50_000,
      status: "REGISTERED" as PlayerRegistrationStatus,
      createdAt: iso(-5 + (i % 4)),
    })),
    {
      id: uid("plyr"),
      tournamentId: "t-delhi-scc",
      userId: DEMO_USERS.PLAYER.id,
      name: DEMO_USERS.PLAYER.name,
      role: "ALL_ROUNDER",
      battingStyle: "Right-hand bat",
      bowlingStyle: "Right-arm medium",
      basePrice: 200_000,
      status: "SOLD",
      createdAt: iso(-25),
    },
    ...Array.from({ length: 95 }).map((_, i) => ({
      id: uid("plyr"),
      tournamentId: "t-delhi-scc",
      userId: `user-player-d${i}`,
      name: `Delhi Player ${i + 1}`,
      role: roles[i % roles.length],
      basePrice: 100_000 + (i % 6) * 50_000,
      status: (i % 3 === 0 ? "SOLD" : "REGISTERED") as PlayerRegistrationStatus,
      createdAt: iso(-25),
    })),
    {
      id: uid("plyr"),
      tournamentId: "t-pune-wwl",
      userId: DEMO_USERS.PLAYER.id,
      name: DEMO_USERS.PLAYER.name,
      role: "ALL_ROUNDER",
      basePrice: 150_000,
      status: "SOLD",
      createdAt: iso(-85),
    },
  ];

  return { tournaments, teams, players };
}

let cache: Db | null = null;

function load(): Db {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      cache = JSON.parse(raw) as Db;
      return cache;
    }
  } catch {
    // ignore corrupted storage
  }
  cache = seed();
  persist();
  return cache;
}

function persist() {
  if (!cache) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // storage may be unavailable (private mode) — fail silently, in-memory cache still works
  }
}

export const mockDb = {
  get(): Db {
    return load();
  },
  save() {
    persist();
  },
  reset() {
    cache = seed();
    persist();
  },
  newId(prefix: string) {
    return uid(prefix);
  },
};