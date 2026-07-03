import {
  setupTestApp,
  teardownTestApp,
  request,
  registerUser,
  authHeader,
} from './helpers.js';
import { USER_ROLES, PLAYER_ROLES } from '../src/config/constants.js';

describe('Cricket Auction Platform API', () => {
  let app;
  let organizerToken;
  let playerToken;
  let owner1Token;
  let owner2Token;
  let tournamentId;
  let franchise1Id;
  let franchise2Id;
  let playerRegistrationId;
  let auctionId;
  let roundId;

  beforeAll(async () => {
    app = await setupTestApp();
  });

  afterAll(async () => {
    await teardownTestApp();
  });

  test('health check', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('registers users with roles', async () => {
    const organizer = await registerUser(app, {
      name: 'Organizer One',
      email: 'organizer@test.com',
      password: 'password123',
      role: USER_ROLES.ORGANIZER,
    });
    expect(organizer.status).toBe(201);
    organizerToken = organizer.body.data.accessToken;

    const player = await registerUser(app, {
      name: 'Player One',
      email: 'player@test.com',
      password: 'password123',
      role: USER_ROLES.PLAYER,
    });
    expect(player.status).toBe(201);
    playerToken = player.body.data.accessToken;

    const owner1 = await registerUser(app, {
      name: 'Owner One',
      email: 'owner1@test.com',
      password: 'password123',
      role: USER_ROLES.FRANCHISE_OWNER,
    });
    owner1Token = owner1.body.data.accessToken;

    const owner2 = await registerUser(app, {
      name: 'Owner Two',
      email: 'owner2@test.com',
      password: 'password123',
      role: USER_ROLES.FRANCHISE_OWNER,
    });
    owner2Token = owner2.body.data.accessToken;
  });

  test('creates tournament and opens registrations', async () => {
    const createRes = await request(app)
      .post('/api/v1/tournaments')
      .set(authHeader(organizerToken))
      .send({
        name: 'Summer League 2026',
        defaultPurse: 5_000_000,
        minBidIncrement: 50_000,
        lotTimerSeconds: 30,
        maxTeams: 4,
        squadSize: 15,
      });

    expect(createRes.status).toBe(201);
    tournamentId = createRes.body.data._id;

    await request(app)
      .post(`/api/v1/tournaments/${tournamentId}/open-player-registration`)
      .set(authHeader(organizerToken))
      .expect(200);

    await request(app)
      .post(`/api/v1/tournaments/${tournamentId}/open-team-registration`)
      .set(authHeader(organizerToken))
      .expect(200);
  });

  test('creates player profile and registers for tournament', async () => {
    await request(app)
      .post('/api/v1/players')
      .set(authHeader(playerToken))
      .send({
        fullName: 'Virat Kohli',
        primaryRole: PLAYER_ROLES.BATSMAN,
        nationality: 'India',
      })
      .expect(201);

    const regRes = await request(app)
      .post(`/api/v1/tournaments/${tournamentId}/registrations/players`)
      .set(authHeader(playerToken))
      .send({ basePrice: 200_000 })
      .expect(201);

    playerRegistrationId = regRes.body.data._id;

    await request(app)
      .patch(`/api/v1/tournaments/${tournamentId}/registrations/players/${playerRegistrationId}/verify`)
      .set(authHeader(organizerToken))
      .expect(200);
  });

  test('registers franchises and tournament teams', async () => {
    const f1 = await request(app)
      .post('/api/v1/franchises')
      .set(authHeader(owner1Token))
      .send({ name: 'Hyderabad Tigers', city: 'Hyderabad' })
      .expect(201);
    franchise1Id = f1.body.data._id;

    const f2 = await request(app)
      .post('/api/v1/franchises')
      .set(authHeader(owner2Token))
      .send({ name: 'Mumbai Strikers', city: 'Mumbai' })
      .expect(201);
    franchise2Id = f2.body.data._id;

    const t1 = await request(app)
      .post(`/api/v1/tournaments/${tournamentId}/registrations/teams`)
      .set(authHeader(owner1Token))
      .send({ franchiseId: franchise1Id })
      .expect(201);

    const t2 = await request(app)
      .post(`/api/v1/tournaments/${tournamentId}/registrations/teams`)
      .set(authHeader(owner2Token))
      .send({ franchiseId: franchise2Id })
      .expect(201);

    await request(app)
      .patch(`/api/v1/tournaments/${tournamentId}/registrations/teams/${t1.body.data._id}/approve`)
      .set(authHeader(organizerToken))
      .expect(200);

    await request(app)
      .patch(`/api/v1/tournaments/${tournamentId}/registrations/teams/${t2.body.data._id}/approve`)
      .set(authHeader(organizerToken))
      .expect(200);

    await request(app)
      .post(`/api/v1/tournaments/${tournamentId}/approve-teams`)
      .set(authHeader(organizerToken))
      .expect(200);
  });

  test('runs full auction lifecycle with bidding', async () => {
    const auctionRes = await request(app)
      .post(`/api/v1/tournaments/${tournamentId}/auction`)
      .set(authHeader(organizerToken))
      .send({})
      .expect(201);

    auctionId = auctionRes.body.data._id;

    const roundRes = await request(app)
      .post(`/api/v1/auctions/${auctionId}/rounds`)
      .set(authHeader(organizerToken))
      .send({ name: 'Marquee', order: 1, playerIds: [playerRegistrationId] })
      .expect(201);
    roundId = roundRes.body.data._id;

    await request(app)
      .post(`/api/v1/auctions/${auctionId}/start`)
      .set(authHeader(organizerToken))
      .expect(200);

    await request(app)
      .post(`/api/v1/auctions/${auctionId}/lot/open`)
      .set(authHeader(organizerToken))
      .send({ tournamentPlayerId: playerRegistrationId, roundId })
      .expect(200);

    const bidRes = await request(app)
      .post(`/api/v1/auctions/${auctionId}/bids`)
      .set(authHeader(owner1Token))
      .send({ amount: 200_000 })
      .expect(201);

    expect(bidRes.body.data.amount).toBe(200_000);

    const counterBid = await request(app)
      .post(`/api/v1/auctions/${auctionId}/bids`)
      .set(authHeader(owner2Token))
      .send({ amount: 250_000 })
      .expect(201);

    expect(counterBid.body.data.amount).toBe(250_000);

    await request(app)
      .post(`/api/v1/auctions/${auctionId}/lot/sold`)
      .set(authHeader(organizerToken))
      .expect(200);

    const liveRes = await request(app)
      .get(`/api/v1/auctions/${auctionId}/live`)
      .expect(200);

    expect(liveRes.body.data.liveState.lotStatus).toBe('pending');

    await request(app)
      .post(`/api/v1/auctions/${auctionId}/complete`)
      .set(authHeader(organizerToken))
      .expect(200);
  });

  test('exports final squads', async () => {
    const exportRes = await request(app)
      .get(`/api/v1/tournaments/${tournamentId}/registrations/squads/export`)
      .expect(200);

    expect(exportRes.body.data.teams).toHaveLength(2);
    const teamWithPlayer = exportRes.body.data.teams.find((t) => t.squad.length === 1);
    expect(teamWithPlayer).toBeTruthy();
    expect(teamWithPlayer.squad[0].boughtPrice).toBe(250_000);
  });

  test('rejects invalid login', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'player@test.com', password: 'wrong-password' });

    expect(res.status).toBe(401);
  });
});
