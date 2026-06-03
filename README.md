# Virtual

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
