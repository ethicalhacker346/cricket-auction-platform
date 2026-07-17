# Cricket Auction Platform — Backend API

Production-grade REST API for cricket tournament auctions built with **Node.js**, **Express 5**, **MongoDB**, and **JWT authentication**.

## Architecture

```
src/
├── config/          # Environment, database, constants
├── models/          # 10 Mongoose collections + embedded subdocs
├── services/        # Business logic & transactions
├── controllers/     # HTTP handlers
├── routes/          # REST endpoints
├── middleware/      # Auth, validation, rate limiting, errors
├── validators/      # Zod schemas
└── utils/           # JWT, helpers, async wrapper
```

### Data model

| Collection | Embedded |
|---|---|
| users | — |
| players | — |
| franchises | — |
| tournaments | — |
| tournament_teams | wallet, roster |
| tournament_players | — |
| auctions | liveState, logs |
| auction_rounds | — |
| bids | — |
| notifications | — |

## Quick start

```bash
cp .env.example .env
npm install
npm run dev
```

API base URL: `http://localhost:5000/api/v1`

## Auth

JWT access + refresh tokens. Register with role:

- `organizer` — creates tournaments, runs auctions
- `franchise_owner` — owns franchises, places bids
- `player` — registers player profile for tournaments

```http
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/refresh
GET  /api/v1/auth/me
```

## Auction lifecycle

```
POST /tournaments                          → create
POST /tournaments/:id/open-player-registration
POST /tournaments/:id/open-team-registration
POST /tournaments/:id/registrations/players
POST /tournaments/:id/registrations/teams
POST /tournaments/:id/approve-teams
POST /tournaments/:id/auction              → create auction
POST /auctions/:id/rounds
POST /auctions/:id/start
POST /auctions/:id/lot/open
POST /auctions/:id/bids                      → franchise owners bid
POST /auctions/:id/lot/sold
POST /auctions/:id/complete
GET  /tournaments/:id/registrations/squads/export
```

## Testing

Uses in-memory MongoDB — no external DB required.

```bash
npm test
```

## Production notes

- Set strong `JWT_*_SECRET` values (32+ chars)
- Use a real MongoDB replica set for transactions
- Put the API behind HTTPS and a reverse proxy
- WebSocket layer for live bidding can be added on top of `/auctions/:id/live`
