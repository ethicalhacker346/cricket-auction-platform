import { PlayerHero } from "./PlayerHero";
import { FranchiseHero } from "./FranchiseHero";
import { OrganizerHero } from "./OrganizerHero";
import { AdminHero } from "./AdminHero";

interface RoleHeroProps {
  user: any;
  playerProfile: any;
  franchise: any;
  organizerStats: { created: number; drafts: number; live: number };
}

export function RoleHero({ user, playerProfile, franchise, organizerStats }: RoleHeroProps) {
  if (!user?.role) return null;

  switch (user.role) {
    case "PLAYER":
      return <PlayerHero user={user} profile={playerProfile} />;
    case "FRANCHISE_OWNER":
      return <FranchiseHero user={user} franchise={franchise} />;
    case "ORGANIZER":
      return <OrganizerHero user={user} stats={organizerStats} />;
    case "ADMIN":
      return <AdminHero user={user} />;
    default:
      return <PlayerHero user={user} profile={playerProfile} />;
  }
}