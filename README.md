# Racing Arena

## Multiplayer With One Public Backend

This game uses a Node backend for multiplayer. The backend serves the game and the multiplayer room connection from the same URL, so players do not need a host laptop once the project is deployed.

## Run Locally

```bash
npm install
npm run build
npm start
```

Open:

```text
http://localhost:5174
```

## Run On LAN

Use this when other laptops are on the same Wi-Fi as the host laptop.

```bash
npm run dev:lan
```

The terminal will show local network URLs. Other laptops should open the Wi-Fi IP URL shown there, for example:

```text
http://192.168.1.124:5173
```

The browser may redirect to HTTPS and show a privacy warning because the local certificate is self-signed. Continue through the warning so camera permissions can work.

## Deploy For Everyone

Deploy the `RacingGame` branch to a Node hosting service such as Render. Everyone should open the hosted HTTPS URL.

### Render

This repo includes `render.yaml`.

1. Push the `RacingGame` branch to GitHub.
2. In Render, create a new **Blueprint** from this repository.
3. Render should use:
   - Build command: `npm ci && npm run build`
   - Start command: `npm start`
   - Environment variable: `NODE_ENV=production`
4. Open the Render URL on every device.
5. Use Multiplayer normally. One player creates a room and others join from the lobby list or room code.

Important: rooms are stored in memory. If the backend restarts or sleeps, active rooms reset.
