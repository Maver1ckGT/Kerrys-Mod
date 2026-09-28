# Kerry's Mod

Browser 3D physics sandbox (Three.js + cannon.js): nextbots, 16 maps, Sandbox / PVP / Bomb Tag / Race / Prop Hunt, online multiplayer.

## Layout
- `server.js` - one Node process: serves `public/` and runs the multiplayer relay (WebSocket at `/ws`).
- `public/` - the game (`index.html`, `net.js` browser adapter, `lib/`, `assets/`).
- `package.json` - only dependency is `ws`. `railway.json` - start command + health check.

## Run locally
    npm install
    npm start          # http://localhost:3000  (open it in two tabs/computers to test multiplayer)

## Deploy on Railway
Railway cannot take a zip upload. Use GitHub or the CLI.
**package.json must be at the ROOT of the repo** (unzip first; don't push the outer folder).

GitHub route:
1. Unzip, create a GitHub repo, push the contents (package.json, server.js, public/ ...).
2. Railway > New Project > Deploy from GitHub repo > pick it. It detects Node and runs `npm start`.
3. Service > Settings > Networking > **Generate Domain** (without this you get no public URL).
4. Open the URL. Host a server in the menu, share the 4-letter code.

CLI route: `npm i -g @railway/cli`, then in this folder: `railway login`, `railway init`, `railway up`, `railway domain`.

## If it still fails
- Build error "no start command / can't detect": package.json isn't at the repo root.
- 502 / "application failed to respond": open Deploy Logs. You should see `Kerry's Mod listening on <port>`. The server already uses Railway's `PORT`; don't hardcode another one.
- Menu says "Multiplayer unavailable": open `https://YOUR-URL/health` (should say ok), then hard-refresh. Ad blockers/VPNs sometimes block WebSockets.
- Works on one device only: everyone must open the same Railway URL (it is also the server).
Other hosts work too (Render, Fly.io, any VPS): they just need `npm install` + `npm start` and WebSocket support.

## Notes
- Rooms are the 4-letter host codes; the server only forwards a room's messages to that room.
- The host's browser simulates props and nextbots; others mirror them. If the host leaves, that room's props/nextbots stop updating.
- Damage/kills are decided by each player's browser (no anti-cheat).
- Bomb Tag requires a hosted multiplayer room with at least two players. Hit the marked carrier to take the bomb; whoever holds it when the 60-second timer expires loses.
- Race loads the Race Circuit and starts every player on a bike. Ride through every checkpoint; each race win adds one win to your record.
- Sandbox vehicles can be spawned from the Q menu; press E near one to drive, WASD to steer, and Space to brake.
- Swap nextbot images in the `IMGS` array in `public/index.html` or upload one in the Q menu.
