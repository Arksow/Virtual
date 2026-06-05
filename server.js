import { networkInterfaces } from "node:os";
import { createServer as createHttpServer } from "node:http";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { createServer as createViteServer } from "vite";
import { WebSocketServer } from "ws";

const host = process.env.HOST ?? "0.0.0.0";
const httpPort = Number(process.env.HTTP_PORT ?? 5173);
const httpsPort = Number(process.env.HTTPS_PORT ?? 5174);
const maxPlayersPerRoom = 5;
const rooms = {};

function createRoomCode() {
  let code = "";
  do {
    code = Math.random().toString(36).slice(2, 6).toUpperCase();
  } while (rooms[code]);
  return code;
}

function normalizeRoomPlayers(players = []) {
  if (!players.length) return [];
  const leaderIndex = players.findIndex((player) => player.leader);
  const nextLeaderIndex = leaderIndex === -1 ? 0 : leaderIndex;
  return players.map((player, index) => ({
    ...player,
    leader: index === nextLeaderIndex,
    ready: index === nextLeaderIndex ? true : player.ready,
  }));
}

function normalizeRoom(room) {
  if (!room) return room;
  return {
    ...room,
    players: normalizeRoomPlayers(room.players ?? []),
    leftPlayerIds: room.leftPlayerIds ?? [],
  };
}

function getFiniteTime(...times) {
  return times.find((time) => Number.isFinite(time)) ?? null;
}

function mergePlayer(existingPlayer = {}, incomingPlayer = {}) {
  const finished = Boolean(existingPlayer.finished || incomingPlayer.finished);
  const finishTime = finished
    ? Math.min(
        ...[existingPlayer.finishTime, incomingPlayer.finishTime].filter((time) => Number.isFinite(time)),
        Infinity,
      )
    : getFiniteTime(incomingPlayer.finishTime, existingPlayer.finishTime);

  return {
    ...existingPlayer,
    ...incomingPlayer,
    finished,
    finishTime: finishTime === Infinity ? getFiniteTime(existingPlayer.finishTime, incomingPlayer.finishTime) : finishTime,
  };
}

function mergeRoom(existingRoom, incomingRoom) {
  if (!existingRoom) return normalizeRoom(incomingRoom);

  const existingPlayers = existingRoom.players ?? [];
  const incomingPlayers = incomingRoom.players ?? [];
  const existingAllFinished = existingPlayers.length > 0 && existingPlayers.every((player) => player.finished);
  const requestedLobbyReset = existingAllFinished && incomingRoom.started === false && incomingRoom.startedAt === null;

  if (requestedLobbyReset) return normalizeRoom(incomingRoom);

  const playersById = new Map(existingPlayers.map((player) => [player.id, player]));
  const leftPlayerIds = new Set([...(existingRoom.leftPlayerIds ?? []), ...(incomingRoom.leftPlayerIds ?? [])]);
  incomingPlayers.filter((player) => !leftPlayerIds.has(player.id)).forEach((player) => {
    playersById.set(player.id, mergePlayer(playersById.get(player.id), player));
  });

  return normalizeRoom({
    ...existingRoom,
    ...incomingRoom,
    leftPlayerIds: [...leftPlayerIds],
    started: Boolean(existingRoom.started || incomingRoom.started),
    startedAt: existingRoom.startedAt ?? incomingRoom.startedAt ?? null,
    players: [...playersById.values()],
  });
}

function send(socket, payload) {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

function broadcastRooms(wss) {
  const payload = JSON.stringify({ type: "rooms", rooms });
  wss.clients.forEach((client) => {
    if (client.readyState === client.OPEN) {
      client.send(payload);
    }
  });
}

function sendActionResult(socket, requestId, result) {
  if (!requestId) return;
  send(socket, { type: "actionResult", requestId, ...result, rooms });
}

function touchSocketRoom(socket, roomCode, playerId) {
  socket.roomCode = roomCode;
  socket.playerId = playerId;
}

function removePlayerFromRoom(roomCode, playerId) {
  const room = rooms[roomCode];
  if (!room || !playerId) return false;
  const remainingPlayers = normalizeRoomPlayers(room.players.filter((player) => player.id !== playerId));
  if (!remainingPlayers.length) {
    delete rooms[roomCode];
  } else {
    rooms[roomCode] = normalizeRoom({
      ...room,
      leftPlayerIds: [...new Set([...(room.leftPlayerIds ?? []), playerId])],
      players: remainingPlayers,
    });
  }
  return true;
}

function handleMessage(wss, socket, event) {
  const message = JSON.parse(event.toString());

  if (message.type === "registerPlayer") {
    socket.roomCode = message.roomCode;
    socket.playerId = message.playerId;
    return;
  }

  if (message.type === "sync") {
    send(socket, { type: "rooms", rooms });
    return;
  }

  if (message.type === "saveRooms") {
    Object.entries(message.rooms ?? {}).forEach(([roomCode, room]) => {
      rooms[roomCode] = mergeRoom(rooms[roomCode], room);
    });
    broadcastRooms(wss);
    return;
  }

  if (message.type === "createRoom") {
    const player = message.player;
    if (!player?.id || !player?.name) {
      sendActionResult(socket, message.requestId, { ok: false, message: "Enter your name before creating a room." });
      return;
    }

    const roomCode = createRoomCode();
    const leader = {
      ...player,
      ready: true,
      leader: true,
      finished: false,
      finishTime: null,
    };
    rooms[roomCode] = normalizeRoom({
      code: roomCode,
      players: [leader],
      started: false,
      startedAt: null,
      leftPlayerIds: [],
    });
    touchSocketRoom(socket, roomCode, player.id);
    sendActionResult(socket, message.requestId, { ok: true, roomCode, room: rooms[roomCode] });
    broadcastRooms(wss);
    return;
  }

  if (message.type === "joinRoom") {
    const roomCode = String(message.roomCode ?? "").trim().toUpperCase();
    const player = message.player;
    const room = rooms[roomCode];
    if (!roomCode || !player?.id || !player?.name) {
      sendActionResult(socket, message.requestId, { ok: false, message: "Enter a room code and player name." });
      return;
    }
    if (!room) {
      sendActionResult(socket, message.requestId, { ok: false, message: "Room code not found." });
      return;
    }
    if (room.started) {
      sendActionResult(socket, message.requestId, { ok: false, message: "Race already started." });
      return;
    }

    const currentPlayers = normalizeRoomPlayers(room.players ?? []);
    const isRejoiningPlayer = currentPlayers.some((roomPlayer) => roomPlayer.id === player.id);
    if (!isRejoiningPlayer && currentPlayers.length >= maxPlayersPerRoom) {
      sendActionResult(socket, message.requestId, { ok: false, message: "Lobby full." });
      return;
    }

    rooms[roomCode] = normalizeRoom({
      ...room,
      leftPlayerIds: (room.leftPlayerIds ?? []).filter((playerId) => playerId !== player.id),
      players: [
        ...currentPlayers.filter((roomPlayer) => roomPlayer.id !== player.id),
        {
          ...player,
          ready: false,
          leader: false,
          finished: false,
          finishTime: null,
        },
      ],
    });
    touchSocketRoom(socket, roomCode, player.id);
    sendActionResult(socket, message.requestId, { ok: true, roomCode, room: rooms[roomCode] });
    broadcastRooms(wss);
    return;
  }

  if (message.type === "toggleReady") {
    const room = rooms[message.roomCode];
    if (!room || !message.playerId) {
      sendActionResult(socket, message.requestId, { ok: false, message: "Room closed." });
      return;
    }

    rooms[message.roomCode] = normalizeRoom({
      ...room,
      players: room.players.map((player) =>
        player.id === message.playerId && !player.leader ? { ...player, ready: !player.ready } : player,
      ),
    });
    sendActionResult(socket, message.requestId, { ok: true, room: rooms[message.roomCode] });
    broadcastRooms(wss);
    return;
  }

  if (message.type === "startRace") {
    const room = rooms[message.roomCode];
    const player = room?.players.find((roomPlayer) => roomPlayer.id === message.playerId);
    if (!room || !player?.leader) {
      sendActionResult(socket, message.requestId, { ok: false, message: "Only the room leader can start." });
      return;
    }
    const otherPlayers = room.players.filter((roomPlayer) => !roomPlayer.leader);
    if (!otherPlayers.length) {
      sendActionResult(socket, message.requestId, { ok: false, message: "Waiting for other players." });
      return;
    }
    if (!otherPlayers.every((roomPlayer) => roomPlayer.ready)) {
      sendActionResult(socket, message.requestId, { ok: false, message: "Waiting for other players to be ready." });
      return;
    }

    rooms[message.roomCode] = normalizeRoom({
      ...room,
      started: true,
      startedAt: Number(message.startedAt) || Date.now(),
      players: room.players.map((roomPlayer, index) => ({
        ...roomPlayer,
        ready: roomPlayer.leader ? true : roomPlayer.ready,
        finished: false,
        finishTime: null,
        carState: message.startStates?.[roomPlayer.id] ?? roomPlayer.carState,
      })),
    });
    sendActionResult(socket, message.requestId, { ok: true, room: rooms[message.roomCode] });
    broadcastRooms(wss);
    return;
  }

  if (message.type === "updatePlayerState") {
    const room = rooms[message.roomCode];
    if (!room || !message.playerId) return;
    rooms[message.roomCode] = normalizeRoom({
      ...room,
      players: room.players.map((player) =>
        player.id === message.playerId
          ? {
              ...player,
              carState: message.carState ?? player.carState,
              finished: message.finished ?? player.finished,
              finishTime: Number.isFinite(message.finishTime) ? message.finishTime : player.finishTime,
            }
          : player,
      ),
    });
    broadcastRooms(wss);
    return;
  }

  if (message.type === "resetLobby") {
    const room = rooms[message.roomCode];
    if (!room) {
      sendActionResult(socket, message.requestId, { ok: false, message: "Room closed." });
      return;
    }
    rooms[message.roomCode] = normalizeRoom({
      ...room,
      started: false,
      startedAt: null,
      players: room.players.map((player, index) => ({
        ...player,
        ready: player.leader,
        finished: false,
        finishTime: null,
        carState: message.startStates?.[player.id] ?? player.carState,
      })),
    });
    sendActionResult(socket, message.requestId, { ok: true, room: rooms[message.roomCode] });
    broadcastRooms(wss);
    return;
  }

  if (message.type === "leaveRoom") {
    if (removePlayerFromRoom(message.roomCode, message.playerId)) {
      broadcastRooms(wss);
    }
  }
}

function getNetworkIps() {
  return Object.values(networkInterfaces())
    .flat()
    .filter((network) => network?.family === "IPv4" && !network.internal)
    .map((network) => network.address);
}

const vite = await createViteServer({
  plugins: [basicSsl()],
  server: {
    host,
    port: httpsPort,
    strictPort: true,
    https: true,
  },
});

await vite.listen();
vite.printUrls();

const wss = new WebSocketServer({ server: vite.httpServer, path: "/multiplayer" });
wss.on("connection", (socket) => {
  send(socket, { type: "rooms", rooms });
  socket.on("message", (event) => {
    try {
      handleMessage(wss, socket, event);
    } catch (error) {
      send(socket, { type: "error", message: "Invalid multiplayer message." });
    }
  });
  socket.on("close", () => {
    if (removePlayerFromRoom(socket.roomCode, socket.playerId)) {
      broadcastRooms(wss);
    }
  });
});

const redirectServer = createHttpServer((request, response) => {
  const requestHost = request.headers.host?.split(":")[0] ?? "localhost";
  response.writeHead(302, {
    Location: `https://${requestHost}:${httpsPort}${request.url ?? "/"}`,
  });
  response.end();
});

redirectServer.listen(httpPort, host, () => {
  console.log("\nLAN multiplayer is ready.");
  console.log(`Open the game on this laptop: https://localhost:${httpsPort}`);
  console.log("Open the game on other laptops using one of these:");
  getNetworkIps().forEach((ip) => {
    console.log(`  https://${ip}:${httpsPort}`);
    console.log(`  http://${ip}:${httpPort}  -> redirects to HTTPS`);
  });
  console.log("\nUse the Wi-Fi IP address. Do not use 192.168.56.1 unless the other laptop is on that same virtual network.");
});
