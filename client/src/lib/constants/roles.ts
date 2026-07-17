import type { UserRole } from "@/types/auth";
import { ShieldCheck, Users, Gavel } from "lucide-react";

// Keep these values in sync with the backend `USER_ROLES` enum
// (config/constants.js) — admin accounts are provisioned separately
// and are not exposed as a self-registration option.
export const USER_ROLES = {
  ADMIN: "ADMIN",
  ORGANIZER: "ORGANIZER",
  FRANCHISE_OWNER: "FRANCHISE_OWNER",
  PLAYER: "PLAYER",
} as const;

export const REGISTERABLE_ROLES: {
  value: UserRole;
  label: string;
  description: string;
  icon: typeof ShieldCheck;
}[] = [
  {
    value: "PLAYER",
    label: "Player",
    description: "Get scouted and go under the hammer in live auctions.",
    icon: Users,
  },
  {
    value: "FRANCHISE_OWNER",
    label: "Team Owner",
    description: "Build your squad by bidding for players in real time.",
    icon: Gavel,
  },
  {
    value: "ORGANIZER",
    label: "Organizer",
    description: "Host and run tournaments with full auction control.",
    icon: ShieldCheck,
  },
];

export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "Administrator",
  ORGANIZER: "Organizer",
  FRANCHISE_OWNER: "Franchise Owner",
  TEAM_OWNER: "Team Owner",
  PLAYER: "Player",
};
