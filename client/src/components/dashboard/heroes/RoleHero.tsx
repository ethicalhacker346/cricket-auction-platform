import { PlayerHero } from "./PlayerHero";
import { FranchiseHero } from "./FranchiseHero";
import { OrganizerHero } from "./OrganizerHero";
import { AdminHero } from "./AdminHero";

interface RoleHeroProps {
  user: any;
  playerProfile: any;
  franchises?: any[] | null;
  franchise?: any;
  isLoading?: boolean;
  organizerStats: { created: number; drafts: number; live: number };
}

export function RoleHero({
  user,
  playerProfile,
  franchises,
  franchise,
  isLoading,
  organizerStats,
}: RoleHeroProps) {
  if (!user?.role) return null;

  switch (user.role) {
    case "PLAYER":
      return <PlayerHero user={user} profile={playerProfile} />;

    case "FRANCHISE_OWNER":
      return (
        <FranchiseHero
          user={user}
          franchises={franchises}
          franchise={franchise}
          isLoading={isLoading}
        />
      );

    case "ORGANIZER":
      return <OrganizerHero user={user} stats={organizerStats} />;

    case "ADMIN":
      return <AdminHero user={user} />;

    default:
      return <PlayerHero user={user} profile={playerProfile} />;
  }
}