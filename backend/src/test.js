import { TournamentPlayer } from './models/TournamentPlayer.js';

// Temporary test in a route or script
const player = await TournamentPlayer.findOne({
  _id: "6a4f3416bdc742e101dafaaa",
  tournamentId: "6a4f466cb4676ec36e48a6fa",
  status: "APPROVED",
  lotOutcome: { $in: ["NOT_LISTED", "UNSOLD"] }
});
console.log("✅ Found:", !!player);