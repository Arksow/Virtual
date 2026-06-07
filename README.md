# Virtual

## Online multiplayer without a host laptop

Deploy the `RacingGame` branch to a Node web service so everyone opens the same public HTTPS URL. The server serves the game and the multiplayer WebSocket together.

## GitHub Pages web link

This repo includes a GitHub Actions workflow that builds the frontend and deploys it to GitHub Pages whenever the `RacingGame` branch is pushed.

1. In GitHub, open **Settings > Pages**.
2. Set **Source** to **GitHub Actions**.
3. Push to the `RacingGame` branch.
4. Open:

   ```text
   https://arksow.github.io/Virtual/
   ```

GitHub Pages can only host the frontend files. Full multiplayer needs the Node backend from the Render setup below.

## itch.io WebGL upload with multiplayer

itch.io can host the WebGL/frontend ZIP, but it cannot run this game's Node multiplayer backend. Deploy the backend first using Render, then point the itch build at that backend.

1. Deploy the backend using the Render setup below.
2. Create your local itch settings file:

   ```bash
   npm run copy-env:itch
   ```

3. Open `.env.itch` and replace the example values:

   ```text
   VITE_MULTIPLAYER_URL=wss://YOUR-RENDER-APP.onrender.com/multiplayer
   ITCH_TARGET=YOUR-ITCH-USERNAME/YOUR-GAME-PAGE:html5
   ```

4. Build and package the itch.io ZIP:

   ```bash
   npm run package:itch
   ```

5. Manual upload option:
   - Upload `release/racing-arena-itch.zip` to itch.io.
   - Set the project kind to **HTML**.
   - Enable **This file will be played in the browser**.

6. JavaScript upload option with Butler:
   - Install itch.io Butler and login once.
   - Make sure `ITCH_TARGET` in `.env.itch` matches your itch project.
   - Run:

     ```bash
     npm run upload:itch
     ```

   The upload script builds the itch version and pushes `dist` to Butler.

Players should all open the itch.io page. Multiplayer rooms will be shared through the hosted backend URL from `.env.itch`.

### Render setup

1. Push this repo to GitHub.
2. In Render, create a new **Blueprint** or **Web Service** from the repo.
3. Use these settings if Render does not read `render.yaml` automatically:
   - Build command: `npm ci && npm run build`
   - Start command: `npm start`
   - Environment variable: `NODE_ENV=production`
4. Open the Render HTTPS URL on every laptop.
5. Use Multiplayer normally. One player creates a room and the others join from the lobby list or room code.

Important: the backend keeps rooms in memory. If the hosting service restarts or sleeps, active rooms reset. For a classroom/demo game this is usually fine; for permanent rooms, add a database later.

## LAN multiplayer

Use this mode when another laptop should join the same multiplayer room.

1. Connect both laptops to the same Wi-Fi or local network.
2. On the host laptop, run:

   ```bash
   npm run dev:lan
   ```

3. Find the host laptop's local IP address.
   - On Windows, run `ipconfig` and look for the `IPv4 Address` on your Wi-Fi adapter.
   - It usually looks like `192.168.x.x` or `10.x.x.x`.
4. On both laptops, open:

   ```text
   http://HOST_IP:5173
   ```

   Replace `HOST_IP` with the host laptop's IP address.
   This redirects to the secure game page, usually `https://HOST_IP:5174`.
   The browser may show a privacy warning because the LAN certificate is local. Choose the advanced/proceed option so camera permissions can work.

5. The host creates a multiplayer room. The second laptop joins using the room code.

Use the Wi-Fi IP address. Do not use `192.168.56.1` unless the other laptop is connected to that same virtual network.

If the second laptop cannot open the page, allow Node.js through the host laptop's firewall for private networks.
