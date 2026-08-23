export type PerformanceTier = "low" | "medium" | "high";

export type ArenaCameraMode =
  | "broadcast"
  | "player-focus"
  | "bid-focus"
  | "franchise-focus"
  | "sold"
  | "unsold";

export interface ImmersiveSceneState {
  cameraMode: ArenaCameraMode;
  cinematicMode: boolean;
  quality: PerformanceTier;
  activityOpen: boolean;
  bidPulseSeq: number;
  playerIntroSeq: number;
  focusedFranchiseId: string | null;
  outcome: ImmersiveAuctionOutcome | null;
  outcomeSeq: number;
  manualCamera: boolean;
  orbitYaw: number;
  orbitPitch: number;
}

export interface ImmersiveAuctionOutcome {
  seq: number;
  type: "sold" | "unsold";
  playerId?: string;
  teamId?: string;
  amount?: number;
}

export interface ArenaVisualPlayer {
  id: string;
  name: string;
  role?: string;
  country?: string;
  overseas?: boolean;
  profileImage?: string;
  tag?: string;
  status?: string;
  basePrice?: number;
  stats?: {
    matches?: number;
    runs?: number;
    wickets?: number;
    average?: number;
    strikeRate?: number;
  };
}

export interface ArenaVisualFranchise {
  id: string;
  name: string;
  shortName?: string;
  logo?: string;
  colorFrom?: string;
  colorTo?: string;
  purseTotal?: number;
  spent?: number;
  reservedBudget?: number;
  squadCount?: number;
  maxSquadSize?: number;
  isLeading?: boolean;
  isUser?: boolean;
}
