import "./styles.css";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

const canvas = document.querySelector("#scene");
const webcamVideo = document.querySelector("#webcam-video");
const handOverlay = document.querySelector("#hand-overlay");
const handOverlayContext = handOverlay.getContext("2d");
const handCursor = document.querySelector("#hand-cursor");
const webcamStartButton = document.querySelector("#webcam-start");
const webcamStopButton = document.querySelector("#webcam-stop");
const webcamStatus = document.querySelector("#webcam-status");
const webcamPanel = document.querySelector(".webcam-panel");
const webcamMessage = document.querySelector("#webcam-message");
const handStatus = document.querySelector("#hand-status");
const lapsLeftLabel = document.querySelector("#laps-left");
const lapsStatusLabel = document.querySelector("#laps-status");
const currentPlaceStat = document.querySelector("#current-place-stat");
const currentPlaceLabel = document.querySelector("#current-place");
const speedStat = document.querySelector("#speed-stat");
const speedValueLabel = document.querySelector("#speed-value");
const raceTimerLabel = document.querySelector("#race-timer");
const gameMenu = document.querySelector("#game-menu");
const helpOpenButton = document.querySelector("#help-open");
const helpCloseButton = document.querySelector("#help-close");
const helpModal = document.querySelector("#help-modal");
const pauseOpenButton = document.querySelector("#pause-open");
const pauseResumeButton = document.querySelector("#pause-resume");
const pauseExitButton = document.querySelector("#pause-exit");
const pauseModal = document.querySelector("#pause-modal");
const raceModeButtons = document.querySelectorAll("[data-menu-mode]");
const countdownLabel = document.querySelector("#countdown-label");
const checkpointFeedback = document.querySelector("#checkpoint-feedback");
const endingScreen = document.querySelector("#ending-screen");
const endingTitle = document.querySelector("#ending-title");
const resultsList = document.querySelector("#results-list");
const resultsMainMenuButton = document.querySelector("#results-main-menu");
const resultsReturnButton = document.querySelector("#results-return");
const carHoverLabel = document.querySelector("#car-hover-label");
const multiplayerConfigForm = document.querySelector("#multiplayer-config");
const multiplayerBackButton = document.querySelector("#multiplayer-back");
const playerNameInput = document.querySelector("#player-name");
const roomCodeInput = document.querySelector("#room-code");
const multiplayerMessage = document.querySelector("#multiplayer-message");
const createRoomButton = document.querySelector("#create-room");
const showJoinRoomButton = document.querySelector("#show-join-room");
const joinRoomButton = document.querySelector("#join-room");
const availableLobbyList = document.querySelector("#available-lobby-list");
const availableLobbiesCount = document.querySelector("#available-lobbies-count");
const refreshLobbiesButton = document.querySelector("#refresh-lobbies");
const activeRoomCodeLabel = document.querySelector("#active-room-code");
const roomPlayerList = document.querySelector("#room-player-list");
const readyToggleButton = document.querySelector("#ready-toggle");
const startMultiplayerButton = document.querySelector("#start-multiplayer");
const leaderWaitingMessage = document.querySelector("#leader-waiting");

function getAppViewportSize() {
  const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
  return {
    width: Math.max(1, Math.round(canvas.parentElement?.clientWidth || viewportWidth)),
    height: Math.max(1, Math.round(window.visualViewport?.height || canvas.parentElement?.clientHeight || viewportHeight)),
  };
}

function updateAppViewportSize() {
  const { height } = getAppViewportSize();
  document.documentElement.style.setProperty("--app-height", `${height}px`);
}

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
updateAppViewportSize();
const initialViewportSize = getAppViewportSize();
renderer.setSize(initialViewportSize.width, initialViewportSize.height);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x93b4cf);
scene.fog = new THREE.Fog(0x93b4cf, 260, 700);

const camera = new THREE.PerspectiveCamera(48, initialViewportSize.width / initialViewportSize.height, 0.1, 600);
camera.position.set(0, 265, 0.1);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.46;
controls.minDistance = 35;
controls.maxDistance = 320;
controls.target.set(0, 0, 0);

const clock = new THREE.Clock();
const world = new THREE.Group();
scene.add(world);
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let hoveredCar = null;

function getRaceClockTime() {
  return performance.now() / 1000;
}

const materials = {
  grass: new THREE.MeshStandardMaterial({ color: 0x466f34, roughness: 0.95 }),
  grassDark: new THREE.MeshStandardMaterial({ color: 0x315629, roughness: 0.98 }),
  asphalt: new THREE.MeshStandardMaterial({ color: 0x202326, roughness: 0.88 }),
  shoulderRed: new THREE.MeshStandardMaterial({ color: 0xb9302d, roughness: 0.7 }),
  shoulderWhite: new THREE.MeshStandardMaterial({ color: 0xf5f1e8, roughness: 0.7 }),
  line: new THREE.MeshBasicMaterial({ color: 0xf6f2d8 }),
  guard: new THREE.MeshStandardMaterial({ color: 0xdfe7ea, roughness: 0.38, metalness: 0.25, side: THREE.DoubleSide }),
  wall: new THREE.MeshStandardMaterial({ color: 0x2e3235, roughness: 0.64 }),
  concrete: new THREE.MeshStandardMaterial({ color: 0x68706b, roughness: 0.92 }),
  sidewalk: new THREE.MeshStandardMaterial({ color: 0xa8ada6, roughness: 0.88 }),
  arenaFloor: new THREE.MeshStandardMaterial({ color: 0x5e665f, roughness: 0.9 }),
  arenaWall: new THREE.MeshStandardMaterial({ color: 0x33383b, roughness: 0.72 }),
  seating: new THREE.MeshStandardMaterial({ color: 0x6e7782, roughness: 0.8 }),
  crowd: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.72 }),
  crowdFace: new THREE.MeshBasicMaterial({ color: 0x111419 }),
  windows: new THREE.MeshStandardMaterial({ color: 0x8cc8e8, roughness: 0.16, metalness: 0.05 }),
  streetPaint: new THREE.MeshBasicMaterial({ color: 0xf7f2d7 }),
  racingLine: new THREE.MeshBasicMaterial({ color: 0xd7f86e, transparent: true, opacity: 0.42, depthWrite: false }),
  blue: new THREE.MeshStandardMaterial({ color: 0x2f70ff, roughness: 0.45, metalness: 0.15 }),
  red: new THREE.MeshStandardMaterial({ color: 0xe23d35, roughness: 0.45, metalness: 0.15 }),
  yellow: new THREE.MeshStandardMaterial({ color: 0xffc638, roughness: 0.45, metalness: 0.15 }),
  glass: new THREE.MeshStandardMaterial({
    color: 0xbde7ff,
    roughness: 0.08,
    metalness: 0.02,
    transparent: true,
    opacity: 0.55,
  }),
};

let webcamStream = null;
let webcamTexture = null;
let webcamScreen = null;
let handLandmarker = null;
let visionFileset = null;
let handTrackingFrame = null;
let lastHandVideoTime = -1;
let isWebcamStarting = false;
let checkpointFeedbackTimer = null;
let placeFeedbackTimer = null;
let lastMultiplayerPositionSync = 0;
let spectatorSwitchCooldown = 0;
let handCursorX = window.innerWidth / 2;
let handCursorY = window.innerHeight / 2;
let handCursorPinched = false;
let handCursorTarget = null;
let selectedLobbyCode = "";
const playerControl = {
  progress: 0.02,
  position: new THREE.Vector3(),
  visualPosition: new THREE.Vector3(),
  heading: 0,
  visualHeading: 0,
  speed: 0,
  targetSpeed: 0,
  steer: 0,
  targetSteer: 0,
  handActive: false,
};
const raceState = {
  totalLaps: 3,
  lapsCompleted: 0,
  nextCheckpoint: 1,
  lastCheckpoint: 0,
  phase: "menu",
  started: false,
  finished: false,
  startTime: 0,
  elapsed: 0,
  finishTime: 0,
  checkpointCooldown: 0,
  countdownDuration: 5,
  countdownStartTime: 0,
  countdownRemaining: 5,
  pauseStartTime: 0,
  mode: "singleplayer",
  playerId: "",
  playerName: "Player 1",
  roomCode: "ARENA",
  isLeader: false,
  players: [],
  spectatingPlayerId: "",
  currentPlaceIndex: -1,
  wrongWayTimer: 0,
  wrongWayDistance: 0,
  wrongWayTeleportGrace: 0,
  wrongWayPreviousProgress: null,
};

const standbyScreenMaterial = new THREE.MeshBasicMaterial({ color: 0x0b1417 });
const trackSamples = [];
const drivableHalfWidth = 12.6;
const playerRailClearance = 0.86;
const checkpointRadius = 17;
const startLineProgress = 0.02;
const gridStartProgress = 0.985;
const checkpointDefinitions = [
  { t: startLineProgress, color: 0x55ff8b },
  { t: 0.34, color: 0x3bb7ff },
  { t: 0.67, color: 0xffd447 },
];
const startCheckpointIndex = 0;
const checkpointMeshes = [];
const confettiBursts = [];
const wrongWayRespawnDelay = 3.25;
const wrongWayMinimumSpeed = 4;
const wrongWayTeleportProgressThreshold = 0.045;
const wrongWayTeleportGraceDelay = 2.25;
const wrongWayProgressEpsilon = 0.00035;
const handControlGuide = {
  maxSpeed: 40,
  fistThreshold: 0.62,
  openThreshold: 0.32,
  steerDeadZone: 0.065,
  maxSteerDelta: 0.28,
  targetSpeedSmoothing: 0.1,
  speedSmoothing: 0.095,
  steerSmoothing: 0.18,
  steerInputSmoothing: 0.18,
  turnRate: 0.95,
};
const handCursorGuide = {
  pinchDownRatio: 0.34,
  pinchUpRatio: 0.48,
  smoothing: 0.36,
};
const speedometerScale = 4;
const singleplayerAiConfigs = [
  { name: "Falcon", color: 0x2f70ff, trim: 0xf5f1e8, speed: 0.031, difficultyRange: [1.04, 1.14] },
  { name: "Viper", color: 0xffc638, trim: 0x222222, speed: 0.027, difficultyRange: [0.99, 1.1] },
  { name: "Comet", color: 0x22c78a, trim: 0x0f2018, speed: 0.025, difficultyRange: [0.95, 1.08] },
  { name: "Nova", color: 0xf064c8, trim: 0x190d16, speed: 0.023, difficultyRange: [0.91, 1.04] },
  { name: "Pulse", color: 0x6de7ff, trim: 0x10202a, speed: 0.021, difficultyRange: [0.88, 1.02] },
];
const singleplayerAiStates = singleplayerAiConfigs.map(() => ({
  finished: false,
  finishTime: 0,
  progress: 0,
  speedMultiplier: 1,
  difficultyMultiplier: 1,
}));

function getAiDifficultyMultiplier(config) {
  const [minDifficulty = 1, maxDifficulty = 1] = config.difficultyRange ?? [1, 1];
  return THREE.MathUtils.lerp(minDifficulty, maxDifficulty, Math.random());
}

function getAiBaseSpeed(config, state) {
  return config.speed * (state?.difficultyMultiplier ?? 1);
}

const formulaGridLanes = [-6.4, 6.4];
const formulaGridRowOffset = 0.022;
const maxMultiplayerPlayers = 5;
const multiplayerCarColors = [
  [0xe23d35, 0x111111],
  [0x2f70ff, 0xf5f1e8],
  [0xffc638, 0x222222],
  [0x22c78a, 0x0f2018],
  [0xf064c8, 0x190d16],
  [0x6de7ff, 0x10202a],
];
const carModelRotationOffset = Math.PI;
const f1ModelPath = `${import.meta.env.BASE_URL}models/ModelCar.fbx`;
const f1ModelScale = 0.015;
const multiplayerStorageKey = "ridgeway-arena-multiplayer-rooms";
const multiplayerRoomChannel =
  "BroadcastChannel" in window ? new BroadcastChannel("ridgeway-arena-multiplayer-rooms") : null;
let multiplayerSocket = null;
let multiplayerSocketConnected = false;
let multiplayerRoomsCache = {};
const multiplayerPendingRequests = new Map();
let loadedF1CarModel = null;
const handConnections = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  [0, 17],
];
const trackPoints = [
  [-74, 0, -18],
  [-63, 0, -52],
  [-28, 0, -65],
  [14, 0, -59],
  [49, 0, -41],
  [67, 0, -8],
  [55, 0, 26],
  [22, 0, 37],
  [2, 0, 62],
  [-34, 0, 56],
  [-63, 0, 31],
  [-82, 0, 8],
];

const trackCurve = new THREE.CatmullRomCurve3(
  trackPoints.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
  true,
  "catmullrom",
  0.5,
);

for (let i = 0; i < 720; i += 1) {
  const t = i / 720;
  trackSamples.push({
    point: trackCurve.getPointAt(t),
    tangent: trackCurve.getTangentAt(t).normalize(),
    t,
  });
}

function sampleCurve(curve, samples) {
  return Array.from({ length: samples }, (_, i) => curve.getPointAt(i / samples));
}

function findNearestTrackSample(position) {
  let nearest = trackSamples[0];
  let nearestDistance = Infinity;

  trackSamples.forEach((sample) => {
    const distance = (position.x - sample.point.x) ** 2 + (position.z - sample.point.z) ** 2;
    if (distance < nearestDistance) {
      nearest = sample;
      nearestDistance = distance;
    }
  });

  return nearest;
}

function keepPlayerOnTrack() {
  const nearest = findNearestTrackSample(playerControl.position);
  const normal = new THREE.Vector3(-nearest.tangent.z, 0, nearest.tangent.x).normalize();
  const offset = new THREE.Vector3().subVectors(playerControl.position, nearest.point).dot(normal);
  const safeHalfWidth = drivableHalfWidth - playerRailClearance;
  const clampedOffset = THREE.MathUtils.clamp(offset, -safeHalfWidth, safeHalfWidth);

  if (Math.abs(clampedOffset - offset) > 0.001) {
    const outwardSide = Math.sign(offset || clampedOffset || 1);
    playerControl.position.copy(nearest.point).addScaledVector(normal, clampedOffset);
    const trackHeading = Math.atan2(nearest.tangent.x, nearest.tangent.z);
    const reverseTrackHeading = trackHeading + Math.PI;
    const forwardDelta = Math.abs(Math.atan2(Math.sin(playerControl.heading - trackHeading), Math.cos(playerControl.heading - trackHeading)));
    const railHeading = forwardDelta <= Math.PI * 0.5 ? trackHeading : reverseTrackHeading;
    const headingVector = new THREE.Vector3(Math.sin(playerControl.heading), 0, Math.cos(playerControl.heading)).normalize();
    const outwardDrive = Math.max(0, headingVector.dot(normal) * outwardSide);
    const headingBlend = THREE.MathUtils.clamp(0.12 + outwardDrive * 0.32, 0.12, 0.44);
    playerControl.heading = lerpAngle(playerControl.heading, railHeading, headingBlend);
    playerControl.visualHeading = lerpAngle(playerControl.visualHeading, playerControl.heading, 0.28);
    playerControl.speed *= THREE.MathUtils.lerp(0.98, 0.72, outwardDrive);
    playerControl.targetSpeed = Math.min(playerControl.targetSpeed, handControlGuide.maxSpeed * THREE.MathUtils.lerp(0.92, 0.68, outwardDrive));
    playerControl.targetSteer *= 0.35;
  }

  playerControl.progress = nearest.t;
}

function makeRibbon(curve, width, material, y = 0.05, samples = 420, offset = 0) {
  const vertices = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i <= samples; i += 1) {
    const t = (i / samples) % 1;
    const center = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    center.addScaledVector(normal, offset);

    const left = center.clone().addScaledVector(normal, width * 0.5);
    const right = center.clone().addScaledVector(normal, -width * 0.5);
    vertices.push(left.x, y, left.z, right.x, y, right.z);
    uvs.push(0, i / 12, 1, i / 12);

    if (i < samples) {
      const base = i * 2;
      indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  return mesh;
}

function makeDashedLine(curve, offset, dashLength, gapLength, width) {
  const group = new THREE.Group();
  const totalLength = curve.getLength();
  const segmentLength = dashLength + gapLength;
  const segments = Math.floor(totalLength / segmentLength);

  for (let i = 0; i < segments; i += 1) {
    const start = (i * segmentLength) / totalLength;
    const mid = (i * segmentLength + dashLength * 0.5) / totalLength;
    const point = curve.getPointAt(mid % 1);
    const tangent = curve.getTangentAt(mid % 1).normalize();
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    point.addScaledVector(normal, offset);

    const dash = new THREE.Mesh(new THREE.BoxGeometry(width, 0.045, dashLength), materials.line);
    dash.position.set(point.x, 0.16, point.z);
    dash.rotation.y = Math.atan2(tangent.x, tangent.z);
    dash.receiveShadow = true;
    group.add(dash);
  }

  return group;
}

function createRoadArrowMarking(material, outlineMaterial) {
  const arrowPoints = [
    new THREE.Vector2(-0.82, -4.1),
    new THREE.Vector2(0.82, -4.1),
    new THREE.Vector2(0.82, 1.1),
    new THREE.Vector2(2.35, 1.1),
    new THREE.Vector2(0, 4.35),
    new THREE.Vector2(-2.35, 1.1),
    new THREE.Vector2(-0.82, 1.1),
  ];
  const triangles = THREE.ShapeUtils.triangulateShape(arrowPoints, []);
  const vertices = [];
  const indices = [];

  arrowPoints.forEach((point) => {
    vertices.push(point.x, 0, point.y);
  });
  triangles.forEach((triangle) => {
    indices.push(...triangle);
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const arrow = new THREE.Group();
  const fill = new THREE.Mesh(geometry, material);
  fill.receiveShadow = true;
  arrow.add(fill);

  const outlinePoints = arrowPoints.map((point) => new THREE.Vector3(point.x, 0.035, point.y));
  outlinePoints.push(outlinePoints[0].clone());
  const outline = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(outlinePoints),
    outlineMaterial,
  );
  arrow.add(outline);

  return arrow;
}

function makeRacingLine(curve) {
  const group = new THREE.Group();

  const arrowMaterial = new THREE.MeshBasicMaterial({
    color: 0x211f1f,
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const arrowOutlineMaterial = new THREE.LineBasicMaterial({
    color: 0xf4ffd0,
    transparent: true,
    opacity: 0.62,
  });

  for (let i = 0; i < 9; i += 1) {
    const t = (i + 0.35) / 9;
    const point = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();
    const arrow = createRoadArrowMarking(arrowMaterial, arrowOutlineMaterial);

    arrow.position.set(point.x, 0.24, point.z);
    arrow.rotation.y = Math.atan2(tangent.x, tangent.z);
    group.add(arrow);
  }

  return group;
}

function makeTrackWall(curve, offset, height = 1.2, samples = 360) {
  const vertices = [];
  const indices = [];

  for (let i = 0; i <= samples; i += 1) {
    const t = (i / samples) % 1;
    const point = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    point.addScaledVector(normal, offset);
    vertices.push(point.x, 0.16, point.z, point.x, height, point.z);

    if (i < samples) {
      const base = i * 2;
      indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const wall = new THREE.Mesh(geometry, materials.guard);
  wall.castShadow = true;
  wall.receiveShadow = true;
  return wall;
}

function addGround() {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(420, 320, 32, 24), materials.arenaFloor);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  ground.receiveShadow = true;
  world.add(ground);

  const apron = makeRibbon(trackCurve, 54, materials.sidewalk, 0.01, 360);
  world.add(apron);

  const infield = new THREE.Mesh(new THREE.CircleGeometry(52, 64), materials.grassDark);
  infield.rotation.x = -Math.PI / 2;
  infield.scale.set(1.18, 0.82, 1);
  infield.position.set(-15, 0.02, 5);
  infield.receiveShadow = true;
  world.add(infield);

  const podium = new THREE.Mesh(new THREE.BoxGeometry(24, 0.8, 14), materials.concrete);
  podium.position.set(-10, 0.36, 12);
  podium.receiveShadow = true;
  world.add(podium);

  const arenaWallShapes = [
    [0, -128, 270, 7, 0],
    [0, 128, 270, 7, 0],
    [-154, 0, 7, 216, 0],
    [154, 0, 7, 216, 0],
  ];
  arenaWallShapes.forEach(([x, z, width, depth]) => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(width, 7, depth), materials.arenaWall);
    wall.position.set(x, 3.45, z);
    wall.castShadow = true;
    wall.receiveShadow = true;
    world.add(wall);
  });

  const bannerColors = [0xd7f86e, 0x3bb7ff, 0xffcf38, 0xe23d35];
  for (let i = 0; i < 22; i += 1) {
    const side = i % 2 === 0 ? -1 : 1;
    const x = -116 + (i % 11) * 23;
    const banner = new THREE.Mesh(
      new THREE.BoxGeometry(15, 3, 0.18),
      new THREE.MeshBasicMaterial({ color: bannerColors[i % bannerColors.length] }),
    );
    banner.position.set(x, 5.3, side * 124.3);
    world.add(banner);
  }
}

function addTrack() {
  world.add(makeRibbon(trackCurve, 21, materials.asphalt, 0.08));
  world.add(makeRibbon(trackCurve, 28, materials.shoulderRed, 0.055, 420));
  world.add(makeRibbon(trackCurve, 25.6, materials.shoulderWhite, 0.065, 420));
  world.add(makeRibbon(trackCurve, 21, materials.asphalt, 0.09));
  world.add(makeRacingLine(trackCurve));

  const start = trackCurve.getPointAt(0.02);
  const tangent = trackCurve.getTangentAt(0.02).normalize();
  const startNormal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
  for (let i = -5; i <= 5; i += 1) {
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.08, 3.4),
      i % 2 === 0 ? materials.line : materials.wall,
    );
    stripe.position.copy(start).addScaledVector(startNormal, i * 1.55);
    stripe.position.y = 0.2;
    stripe.rotation.y = Math.atan2(tangent.x, tangent.z) + Math.PI / 2;
    world.add(stripe);
  }
}

function addPitLane() {
  const pitCurve = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(-52, 0, -44),
      new THREE.Vector3(-22, 0, -50),
      new THREE.Vector3(12, 0, -47),
      new THREE.Vector3(39, 0, -32),
    ],
    false,
    "catmullrom",
    0.4,
  );
  world.add(makeRibbon(pitCurve, 8.5, materials.asphalt, 0.12, 150));
  world.add(makeDashedLine(pitCurve, 0, 2.6, 3.3, 0.22));
}

function addCheckpointFlag(t, color) {
  const point = trackCurve.getPointAt(t);
  const tangent = trackCurve.getTangentAt(t).normalize();
  const flag = new THREE.Group();

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(1.35, 1.65, 0.42, 18),
    new THREE.MeshStandardMaterial({ color: 0x111514, roughness: 0.55, metalness: 0.14 }),
  );
  base.position.y = 0.21;
  base.castShadow = true;
  base.receiveShadow = true;

  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.16, 7.4, 12),
    new THREE.MeshStandardMaterial({ color: 0xf5f7ef, roughness: 0.34, metalness: 0.55 }),
  );
  pole.position.y = 3.9;
  pole.castShadow = true;

  const flagMaterial = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.42,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });
  const flagGeometry = new THREE.PlaneGeometry(3.8, 2.2, 6, 1);
  const positions = flagGeometry.attributes.position;
  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i);
    positions.setZ(i, Math.sin((x + 1.9) * 2.2) * 0.16);
  }
  positions.needsUpdate = true;
  flagGeometry.computeVertexNormals();

  const cloth = new THREE.Mesh(flagGeometry, flagMaterial);
  cloth.position.set(2.02, 5.9, 0);
  cloth.castShadow = true;

  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(3.6, 0.12, 0.08),
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
  );
  stripe.position.set(2.08, 5.9, 0.04);

  flag.add(base, pole, cloth, stripe);
  flag.position.set(point.x, 0.1, point.z);
  flag.rotation.y = Math.atan2(tangent.x, tangent.z) - Math.PI * 0.5;
  flag.visible = false;
  world.add(flag);
  checkpointMeshes.push(flag);
}

function addTrackFurniture() {
  world.add(makeTrackWall(trackCurve, 14.25, 1.25));
  world.add(makeTrackWall(trackCurve, -14.25, 1.25));

  checkpointDefinitions.forEach((checkpoint) => {
    addCheckpointFlag(checkpoint.t, checkpoint.color);
  });
}

function addCrowdBlock(origin, columns, rows, spacingX, spacingY, rowDepth, rotationY) {
  const crowdGeometry = new THREE.BoxGeometry(0.9, 1.2, 0.7);
  const faceGeometry = new THREE.BoxGeometry(0.46, 0.36, 0.1);
  const crowd = new THREE.InstancedMesh(crowdGeometry, materials.crowd, columns * rows);
  const faces = new THREE.InstancedMesh(faceGeometry, materials.crowdFace, columns * rows);
  const matrix = new THREE.Matrix4();
  const faceMatrix = new THREE.Matrix4();
  const color = new THREE.Color();
  const palette = [0xf3f6ff, 0xd7f86e, 0x3bb7ff, 0xffcf38, 0xe23d35, 0xffffff];
  let index = 0;

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const localX = (column - (columns - 1) / 2) * spacingX;
      const localY = 2.4 + row * spacingY;
      const localZ = row * rowDepth;
      const worldX = origin.x + Math.cos(rotationY) * localX + Math.sin(rotationY) * localZ;
      const worldZ = origin.z - Math.sin(rotationY) * localX + Math.cos(rotationY) * localZ;
      const facingY = Math.atan2(-worldX, -worldZ);
      const faceDirection = new THREE.Vector3(-worldX, 0, -worldZ).normalize();
      matrix.makeRotationY(facingY);
      matrix.setPosition(worldX, origin.y + localY, worldZ);
      faceMatrix.makeRotationY(facingY);
      faceMatrix.setPosition(worldX + faceDirection.x * 0.42, origin.y + localY + 0.12, worldZ + faceDirection.z * 0.42);
      crowd.setMatrixAt(index, matrix);
      faces.setMatrixAt(index, faceMatrix);
      crowd.setColorAt(index, color.setHex(palette[(row + column) % palette.length]));
      index += 1;
    }
  }

  crowd.instanceMatrix.needsUpdate = true;
  faces.instanceMatrix.needsUpdate = true;
  crowd.castShadow = true;
  faces.castShadow = true;
  world.add(crowd);
  world.add(faces);
}

function addGrandstand(origin, width, rows, rotationY) {
  const standRotation = rotationY + Math.PI;
  const stand = new THREE.Group();
  for (let row = 0; row < rows; row += 1) {
    const tier = new THREE.Mesh(new THREE.BoxGeometry(width, 1.1, 4.2), materials.seating);
    tier.position.set(0, 0.65 + row * 1.55, row * 4.2);
    tier.castShadow = true;
    tier.receiveShadow = true;
    stand.add(tier);
  }

  const roof = new THREE.Mesh(new THREE.BoxGeometry(width + 8, 1.0, 9), materials.guard);
  roof.position.set(0, rows * 1.55 + 2.8, rows * 4.2 + 2);
  roof.castShadow = true;
  stand.add(roof);

  stand.position.copy(origin);
  stand.rotation.y = standRotation;
  world.add(stand);
  addCrowdBlock(origin, Math.floor(width / 3.6), rows, 3.2, 1.55, 4.2, standRotation);
}

function addStandsAndProps() {
  addGrandstand(new THREE.Vector3(0, 0.2, -92), 112, 8, 0);
  addGrandstand(new THREE.Vector3(0, 0.2, 92), 112, 8, Math.PI);
  addGrandstand(new THREE.Vector3(-112, 0.2, 0), 88, 7, Math.PI / 2);
  addGrandstand(new THREE.Vector3(112, 0.2, 0), 88, 7, -Math.PI / 2);

  const raceControl = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(10, 22, 10), materials.wall);
  base.position.y = 11;
  const booth = new THREE.Mesh(new THREE.BoxGeometry(16, 5, 12), materials.glass);
  booth.position.y = 24.5;
  raceControl.add(base, booth);
  raceControl.position.set(-94, 0.1, -82);
  raceControl.traverse((child) => {
    child.castShadow = true;
    child.receiveShadow = true;
  });
  world.add(raceControl);

  const screenRig = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(22, 13, 1), materials.wall);
  frame.position.y = 10;
  frame.castShadow = true;
  frame.receiveShadow = true;

  webcamScreen = new THREE.Mesh(new THREE.PlaneGeometry(19, 10.6), standbyScreenMaterial);
  webcamScreen.position.set(0, 10, 0.56);
  webcamScreen.rotation.y = Math.PI;

  const mastLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 11, 10), materials.guard);
  const mastRight = mastLeft.clone();
  mastLeft.position.set(-8, 4.8, -0.7);
  mastRight.position.set(8, 4.8, -0.7);
  screenRig.add(frame, webcamScreen, mastLeft, mastRight);
  screenRig.position.set(82, 0.1, 84);
  screenRig.rotation.y = -0.52;
  world.add(screenRig);

  [
    [-126, -96],
    [126, -96],
    [-126, 96],
    [126, 96],
  ].forEach(([x, z]) => {
    const tower = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.65, 32, 12), materials.wall);
    pole.position.y = 16;
    const lightBar = new THREE.Mesh(new THREE.BoxGeometry(13, 2, 2), materials.guard);
    lightBar.position.y = 32.6;
    tower.add(pole, lightBar);

    [-4, 0, 4].forEach((offset) => {
      const lamp = new THREE.SpotLight(0xfff4c7, 1.75, 170, Math.PI / 5.5, 0.48, 1.15);
      lamp.position.set(offset, 31.6, 0);
      lamp.target.position.set(0, 0, 0);
      tower.add(lamp, lamp.target);
    });

    tower.position.set(x, 0, z);
    tower.rotation.y = Math.atan2(-x, -z);
    tower.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    world.add(tower);
  });
}

function createWedgeBodyGeometry() {
  const vertices = new Float32Array([
    -2.4, 0, -3.7,
    2.4, 0, -3.7,
    2.0, 0, 3.5,
    -2.0, 0, 3.5,
    -1.9, 1.0, -2.6,
    1.9, 1.0, -2.6,
    1.35, 0.72, 3.3,
    -1.35, 0.72, 3.3,
    -1.3, 1.35, -0.95,
    1.3, 1.35, -0.95,
    1.05, 1.15, 1.1,
    -1.05, 1.15, 1.1,
  ]);
  const indices = [
    0, 1, 5,
    0, 5, 4,
    1, 2, 6,
    1, 6, 5,
    2, 3, 7,
    2, 7, 6,
    3, 0, 4,
    3, 4, 7,
    4, 5, 9,
    4, 9, 8,
    5, 6, 10,
    5, 10, 9,
    6, 7, 11,
    6, 11, 10,
    7, 4, 8,
    7, 8, 11,
    8, 9, 10,
    8, 10, 11,
    0, 3, 2,
    0, 2, 1,
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createCar(color, trimColor = 0x111111) {
  const car = new THREE.Group();
  car.userData.trimColor = trimColor;
  const fallbackModel = new THREE.Group();
  fallbackModel.userData.fallbackModel = true;
  const body = new THREE.Mesh(createWedgeBodyGeometry(), color);
  body.userData.paint = true;
  body.position.y = 0.48;
  body.castShadow = true;

  const nose = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.18, 2.1), color);
  nose.userData.paint = true;
  nose.position.set(0, 0.86, -2.8);
  nose.rotation.x = 0.09;
  nose.castShadow = true;

  const cockpit = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.78, 1.8), materials.glass);
  cockpit.position.set(0, 1.65, -0.3);
  cockpit.scale.set(1, 0.7, 1);
  cockpit.castShadow = true;

  const wing = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.24, 0.9), new THREE.MeshStandardMaterial({ color: trimColor }));
  wing.position.set(0, 1.28, 3.42);
  wing.castShadow = true;

  const splitter = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.14, 0.55), new THREE.MeshStandardMaterial({ color: trimColor }));
  splitter.position.set(0, 0.42, -3.78);
  splitter.castShadow = true;

  const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x0c0d0d, roughness: 0.55 });
  [-2.22, 2.22].forEach((x) => {
    [-2.48, 2.35].forEach((z) => {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.68, 24), wheelMaterial);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.55, z);
      wheel.castShadow = true;
      fallbackModel.add(wheel);
    });
  });

  const headlightMaterial = new THREE.MeshBasicMaterial({ color: 0xd8fff5 });
  [-1.05, 1.05].forEach((x) => {
    const headlight = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.12, 0.08), headlightMaterial);
    headlight.position.set(x, 0.88, -3.86);
    fallbackModel.add(headlight);
  });

  fallbackModel.add(body, nose, cockpit, wing, splitter);
  car.add(fallbackModel);
  return car;
}

function getCarPaintColor(car) {
  let paintColor = 0xe23d35;
  car.traverse((child) => {
    const materialsToCheck = Array.isArray(child.material) ? child.material : [child.material];
    if (child.userData.paint && materialsToCheck[0]?.color) {
      paintColor = materialsToCheck[0].color.getHex();
    }
  });
  return paintColor;
}

function getCarTrimColor(car) {
  return car.userData.trimColor ?? 0x111111;
}

function getPaintVariants(paintColor, trimColor) {
  const body = new THREE.Color(paintColor);
  const accent = new THREE.Color(paintColor).lerp(new THREE.Color(0xffffff), 0.28);
  const shadow = new THREE.Color(paintColor).lerp(new THREE.Color(0x050606), 0.32);
  return {
    body,
    accent: trimColor === 0x111111 ? accent : new THREE.Color(trimColor),
    highlight: shadow,
  };
}

function createLoadedCarMaterialPalette(paintColor, trimColor) {
  const variants = getPaintVariants(paintColor, trimColor);
  return {
    body: new THREE.MeshStandardMaterial({ color: variants.body, roughness: 0.38, metalness: 0.2 }),
    accent: new THREE.MeshStandardMaterial({ color: variants.accent, roughness: 0.42, metalness: 0.18 }),
    highlight: new THREE.MeshStandardMaterial({ color: variants.highlight, roughness: 0.36, metalness: 0.22 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x070808, roughness: 0.62, metalness: 0.08 }),
    tire: new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.78, metalness: 0.02 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x858b8d, roughness: 0.34, metalness: 0.72 }),
  };
}

function chooseF1Material(originalMaterial, objectName, palette) {
  const materialName = (originalMaterial?.name ?? "").toLowerCase();
  const name = `${objectName} ${materialName}`.toLowerCase();
  if (name.includes("tire")) return palette.tire;
  if (materialName.includes("mirror")) return palette.metal;
  if (materialName.includes("2ndcolor") || materialName.includes("bloody red")) return palette.accent;
  if (materialName.includes("3rdcolor")) return palette.highlight;
  if (materialName.includes("basecolor")) return palette.body;
  if (materialName.includes("dark black") || name.includes("rod") || name.includes("exhaust") || name.includes("wing")) {
    return palette.dark;
  }
  return palette.body;
}

function setLoadedCarPaint(car, bodyColor) {
  const variants = getPaintVariants(bodyColor, getCarTrimColor(car));
  car.traverse((child) => {
    const paintMaterials = child.userData.paintMaterials ?? [];
    paintMaterials.forEach(({ material, role }) => {
      if (role === "body") material.color.copy(variants.body);
      if (role === "accent") material.color.copy(variants.accent);
      if (role === "highlight") material.color.copy(variants.highlight);
    });
  });
}

function fitModelToCar(model) {
  const bounds = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  bounds.getSize(size);
  if (!size.length()) return;

  const targetLength = 7.6;
  const targetWidth = 5.2;
  const modelScale = Math.min(targetLength / Math.max(size.z, 0.001), targetWidth / Math.max(size.x, 0.001));
  model.scale.multiplyScalar(modelScale);

  const fittedBounds = new THREE.Box3().setFromObject(model);
  const center = new THREE.Vector3();
  fittedBounds.getCenter(center);
  model.position.sub(center);
  const groundedBounds = new THREE.Box3().setFromObject(model);
  model.position.y -= groundedBounds.min.y;
}

function applyLoadedCarModel(car, sourceModel) {
  const paintColor = getCarPaintColor(car);
  const trimColor = getCarTrimColor(car);
  const loadedModel = sourceModel.clone(true);
  loadedModel.userData.loadedCarModel = true;
  loadedModel.scale.setScalar(f1ModelScale);
  loadedModel.rotation.y = Math.PI;

  const palette = createLoadedCarMaterialPalette(paintColor, trimColor);

  loadedModel.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;
    const originalMaterials = Array.isArray(child.material) ? child.material : [child.material];
    const assignedMaterials = originalMaterials.map((material) => chooseF1Material(material, child.name, palette));
    child.material = Array.isArray(child.material) ? assignedMaterials : assignedMaterials[0];
    child.userData.paintMaterials = assignedMaterials
      .map((material) => {
        if (material === palette.body) return { material, role: "body" };
        if (material === palette.accent) return { material, role: "accent" };
        if (material === palette.highlight) return { material, role: "highlight" };
        return null;
      })
      .filter(Boolean);
    child.userData.paint = child.userData.paintMaterials.length > 0;
    child.userData.hoverCar = car;
  });

  fitModelToCar(loadedModel);
  car.children.filter((child) => child.userData.loadedCarModel).forEach((child) => car.remove(child));
  car.children.forEach((child) => {
    if (child.userData.fallbackModel) child.visible = false;
  });
  car.add(loadedModel);
}

function loadF1CarModel() {
  const loader = new FBXLoader();
  loader.load(
    f1ModelPath,
    (model) => {
      loadedF1CarModel = model;
      [...singleplayerAiCars, playerCar, ...remotePlayerCars.values()].forEach((car) => applyLoadedCarModel(car, model));
    },
    undefined,
    (error) => {
      console.warn("Could not load F1 car model, using fallback cars:", error);
    },
  );
}

const playerCar = createCar(materials.red, 0x111111);
const singleplayerAiCars = singleplayerAiConfigs.map((config) =>
  createCar(new THREE.MeshStandardMaterial({ color: config.color, roughness: 0.45, metalness: 0.15 }), config.trim),
);
world.add(playerCar, ...singleplayerAiCars);

function markCarForHover(car, fallbackName) {
  car.userData.hoverName = fallbackName;
  car.traverse((child) => {
    child.userData.hoverCar = car;
  });
}

function createCarNameLabel() {
  const label = document.createElement("p");
  label.className = "car-name-label is-hidden";
  label.setAttribute("aria-hidden", "true");
  document.querySelector("#app").append(label);
  return label;
}

function ensureCarNameLabel(car) {
  if (!car.userData.nameLabel) {
    car.userData.nameLabel = createCarNameLabel();
  }
  return car.userData.nameLabel;
}

function setCarDisplayName(car, name) {
  car.userData.hoverName = name;
  ensureCarNameLabel(car).textContent = name;
}

markCarForHover(playerCar, "Player 1");
setCarDisplayName(playerCar, "Player 1");
singleplayerAiCars.forEach((car, index) => {
  markCarForHover(car, singleplayerAiConfigs[index].name);
  setCarDisplayName(car, singleplayerAiConfigs[index].name);
});
const remotePlayerCars = new Map();
loadF1CarModel();

function getLocalPlayer() {
  return raceState.players.find((player) => player.id === raceState.playerId);
}

function getOpponentPlayer() {
  return raceState.players.find((player) => player.id !== raceState.playerId);
}

function getFormulaGridStartPose(index = 0) {
  const row = Math.floor(index / 2);
  const side = index % 2;
  const lane = formulaGridLanes[side];
  const visualProgress = (gridStartProgress - row * formulaGridRowOffset + 1) % 1;
  const point = trackCurve.getPointAt(visualProgress);
  const tangent = trackCurve.getTangentAt(visualProgress).normalize();
  const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
  point.addScaledVector(normal, lane);
  return {
    x: point.x,
    z: point.z,
    heading: Math.atan2(tangent.x, tangent.z),
    progress: gridStartProgress,
    visualProgress,
    lane,
    lapsCompleted: 0,
  };
}

function getMultiplayerStartPose(index = 0) {
  return getFormulaGridStartPose(index);
}

function getSingleplayerStartPose(index = 0) {
  return getFormulaGridStartPose(index);
}

function getPlayerCarState() {
  return {
    x: playerControl.position.x,
    z: playerControl.position.z,
    heading: playerControl.heading,
    progress: playerControl.progress,
    lapsCompleted: raceState.lapsCompleted,
    lastCheckpoint: raceState.lastCheckpoint,
    speed: playerControl.speed,
    updatedAt: Date.now(),
  };
}

function setCarPaint(car, playerIndex) {
  const [bodyColor] = multiplayerCarColors[playerIndex % multiplayerCarColors.length];
  car.traverse((child) => {
    const materialsToPaint = Array.isArray(child.material) ? child.material : [child.material];
    if (child.userData.paint && !child.userData.paintMaterials && materialsToPaint[0]?.color) {
      materialsToPaint[0].color.setHex(bodyColor);
    }
  });
  setLoadedCarPaint(car, bodyColor);
}

function applyCarStateToPlayerControl(carState) {
  if (!carState) return;
  playerControl.position.set(carState.x, 0, carState.z);
  playerControl.heading = carState.heading;
  playerControl.visualPosition.copy(playerControl.position);
  playerControl.visualHeading = playerControl.heading;
  playerControl.progress = carState.progress ?? playerControl.progress;
  placePlayerCar();
}

function lerpAngle(from, to, amount) {
  const delta = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + delta * amount;
}

function syncVisualPlayerPose() {
  playerControl.visualPosition.copy(playerControl.position);
  playerControl.visualHeading = playerControl.heading;
}

function smoothVisualPlayerPose(delta) {
  const positionSmoothing = 1 - Math.exp(-delta * 14);
  const headingSmoothing = 1 - Math.exp(-delta * 18);
  playerControl.visualPosition.lerp(playerControl.position, positionSmoothing);
  playerControl.visualHeading = lerpAngle(playerControl.visualHeading, playerControl.heading, headingSmoothing);
}

function updateLocalMultiplayerCarState(force = false) {
  if (raceState.mode !== "multiplayer" || !raceState.roomCode || !raceState.playerId) return;
  const now = Date.now();
  if (!force && now - lastMultiplayerPositionSync < 80) return;
  lastMultiplayerPositionSync = now;
  const carState = getPlayerCarState();
  const room = getStoredRoom();
  if (room) {
    const updatedRoom = {
      ...room,
      players: room.players.map((player) =>
        player.id === raceState.playerId ? { ...player, carState } : player,
      ),
    };
    multiplayerRoomsCache = { ...getStoredRooms(), [raceState.roomCode]: updatedRoom };
    raceState.players = updatedRoom.players;
  }
  sendMultiplayerMessage({
    type: "updatePlayerState",
    roomCode: raceState.roomCode,
    playerId: raceState.playerId,
    carState,
  });
}

function applyLocalMultiplayerIdentity() {
  if (raceState.mode !== "multiplayer") return;
  const localIndex = Math.max(
    0,
    raceState.players.findIndex((player) => player.id === raceState.playerId),
  );
  setCarPaint(playerCar, localIndex);
  const localPlayer = getLocalPlayer();
  if (localPlayer?.carState && raceState.phase !== "racing") {
    applyCarStateToPlayerControl(localPlayer.carState);
  }
}

function updateCarHoverNames() {
  const localPlayer = getLocalPlayer();
  setCarDisplayName(playerCar, raceState.mode === "singleplayer" ? "You" : localPlayer?.name || raceState.playerName || "Player 1");
  singleplayerAiCars.forEach((car, index) => {
    setCarDisplayName(car, singleplayerAiConfigs[index].name);
  });
  remotePlayerCars.forEach((car, playerId) => {
    const player = raceState.players.find((item) => item.id === playerId);
    setCarDisplayName(car, player?.name || "Player");
  });
}

function placeCar(car, t, laneOffset, yawOffset = 0) {
  const point = trackCurve.getPointAt(t % 1);
  const tangent = trackCurve.getTangentAt(t % 1).normalize();
  const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
  point.addScaledVector(normal, laneOffset);
  car.position.set(point.x, 0.24, point.z);
  car.rotation.y = Math.atan2(tangent.x, tangent.z) + yawOffset + carModelRotationOffset;
}

function placePlayerCar() {
  playerCar.position.set(playerControl.visualPosition.x, 0.24, playerControl.visualPosition.z);
  playerCar.rotation.y = playerControl.visualHeading + carModelRotationOffset;
}

function placePlayerOnTrack(t, laneOffset) {
  playerControl.progress = t;
  const point = trackCurve.getPointAt(t);
  const tangent = trackCurve.getTangentAt(t).normalize();
  const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
  point.addScaledVector(normal, laneOffset);
  playerControl.position.copy(point);
  playerControl.heading = Math.atan2(tangent.x, tangent.z);
  syncVisualPlayerPose();
  placePlayerCar();
}

function getWrappedProgressDelta(currentProgress, previousProgress) {
  let delta = currentProgress - previousProgress;
  if (delta > 0.5) delta -= 1;
  if (delta < -0.5) delta += 1;
  return delta;
}

function getPlayerTrackLaneOffset() {
  const nearest = findNearestTrackSample(playerControl.position);
  const normal = new THREE.Vector3(-nearest.tangent.z, 0, nearest.tangent.x).normalize();
  return THREE.MathUtils.clamp(
    new THREE.Vector3().subVectors(playerControl.position, nearest.point).dot(normal),
    -drivableHalfWidth + playerRailClearance,
    drivableHalfWidth - playerRailClearance,
  );
}

function resetWrongWayTracker() {
  raceState.wrongWayTimer = 0;
  raceState.wrongWayDistance = 0;
  raceState.wrongWayTeleportGrace = 0;
  raceState.wrongWayPreviousProgress = playerControl.progress;
  clearWrongWayFeedback();
}

function respawnPlayerAtLastCheckpoint() {
  const checkpointIndex = raceState.lastCheckpoint ?? startCheckpointIndex;
  const checkpoint = checkpointDefinitions[checkpointIndex] ?? checkpointDefinitions[startCheckpointIndex];
  const laneOffset = getPlayerTrackLaneOffset();
  placePlayerOnTrack(checkpoint.t, laneOffset);
  playerControl.speed = 0;
  playerControl.targetSpeed = 0;
  playerControl.steer = 0;
  playerControl.targetSteer = 0;
  raceState.checkpointCooldown = 0.9;
  showWrongWayFeedback("Teleport To Checkpoint", true);
  checkpointFeedbackTimer = window.setTimeout(() => {
    clearWrongWayFeedback();
  }, 1200);
  raceState.wrongWayTimer = 0;
  raceState.wrongWayDistance = 0;
  raceState.wrongWayTeleportGrace = 0;
  raceState.wrongWayPreviousProgress = playerControl.progress;
  raceState.currentPlaceIndex = -1;
  updateLocalMultiplayerCarState(true);
  updateCheckpointVisibility();
  updateOpponentVisibility();
  updateRaceHud();
}

function updateWrongWayRespawn(delta) {
  if (raceState.phase !== "racing" || !raceState.started || raceState.finished) {
    raceState.wrongWayTimer = 0;
    raceState.wrongWayDistance = 0;
    raceState.wrongWayTeleportGrace = 0;
    raceState.wrongWayPreviousProgress = null;
    clearWrongWayFeedback();
    return;
  }

  if (raceState.wrongWayPreviousProgress === null) {
    raceState.wrongWayPreviousProgress = playerControl.progress;
    return;
  }

  const progressDelta = getWrappedProgressDelta(playerControl.progress, raceState.wrongWayPreviousProgress);
  raceState.wrongWayPreviousProgress = playerControl.progress;

  if (progressDelta < -wrongWayProgressEpsilon) {
    raceState.wrongWayDistance += Math.abs(progressDelta);
    if (Math.abs(playerControl.speed) >= wrongWayMinimumSpeed) {
      raceState.wrongWayTimer += delta;
    }
  } else if (progressDelta > wrongWayProgressEpsilon) {
    resetWrongWayTracker();
    return;
  } else {
    if (raceState.wrongWayDistance <= 0.002) {
      raceState.wrongWayTimer = Math.max(0, raceState.wrongWayTimer - delta * 1.6);
      if (raceState.wrongWayTimer <= 0.05) {
        raceState.wrongWayDistance = 0;
        raceState.wrongWayTeleportGrace = 0;
        clearWrongWayFeedback();
      }
    }
  }

  const hasWrongWayDistance = raceState.wrongWayDistance >= wrongWayTeleportProgressThreshold;
  if (hasWrongWayDistance) {
    raceState.wrongWayTeleportGrace += delta;
  } else {
    raceState.wrongWayTeleportGrace = 0;
  }

  const isAboutToTeleport =
    raceState.wrongWayTimer >= wrongWayRespawnDelay - 0.7 ||
    raceState.wrongWayTeleportGrace >= Math.max(wrongWayTeleportGraceDelay - 0.8, 0);

  if (raceState.wrongWayDistance > 0.002 || raceState.wrongWayTimer > 0.05) {
    showWrongWayFeedback(isAboutToTeleport ? "Teleport To Checkpoint" : "Wrong Way", isAboutToTeleport);
  }

  if (raceState.wrongWayTimer >= wrongWayRespawnDelay || raceState.wrongWayTeleportGrace >= wrongWayTeleportGraceDelay) {
    respawnPlayerAtLastCheckpoint();
  }
}

function updateOpponentVisibility() {
  const showAiCars = raceState.mode !== "multiplayer";
  if (showAiCars) {
    setCarPaint(playerCar, 0);
  }
  singleplayerAiCars.forEach((car, index) => {
    car.visible = showAiCars && !singleplayerAiStates[index].finished;
  });
  remotePlayerCars.forEach((car, playerId) => {
    const player = raceState.players.find((item) => item.id === playerId);
    car.visible = raceState.mode === "multiplayer" && Boolean(player) && !player.finished;
  });
  updateCarHoverNames();
  updateCarNameLabels();
}

function createRemotePlayerCar(playerIndex) {
  const [bodyColor, trimColor] = multiplayerCarColors[playerIndex % multiplayerCarColors.length];
  const car = createCar(new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.45, metalness: 0.15 }), trimColor);
  if (loadedF1CarModel) {
    applyLoadedCarModel(car, loadedF1CarModel);
  }
  markCarForHover(car, "Player");
  car.userData.targetPosition = new THREE.Vector3();
  car.userData.targetHeading = 0;
  car.visible = raceState.mode === "multiplayer";
  world.add(car);
  return car;
}

function renderRemotePlayerCars() {
  if (raceState.mode !== "multiplayer") {
    remotePlayerCars.forEach((car) => {
      car.visible = false;
      car.userData.hasPose = false;
    });
    return;
  }

  const remotePlayers = raceState.players.filter((player) => player.id !== raceState.playerId);
  const activeRemoteIds = new Set(remotePlayers.map((player) => player.id));

  remotePlayerCars.forEach((car, playerId) => {
    if (!activeRemoteIds.has(playerId)) {
      car.visible = false;
      car.userData.hasPose = false;
    }
  });

  remotePlayers.forEach((player, remoteIndex) => {
    const playerIndex = Math.max(0, raceState.players.findIndex((item) => item.id === player.id));
    let car = remotePlayerCars.get(player.id);
    if (!car) {
      car = createRemotePlayerCar(playerIndex);
      remotePlayerCars.set(player.id, car);
    }
    setCarPaint(car, playerIndex);

    const carState = player.carState ?? getMultiplayerStartPose(playerIndex || remoteIndex + 1);
    car.userData.targetPosition.set(carState.x, 0.24, carState.z);
    car.userData.targetHeading = carState.heading + carModelRotationOffset;
    if (!car.userData.hasPose) {
      car.position.copy(car.userData.targetPosition);
      car.rotation.y = car.userData.targetHeading;
      car.userData.hasPose = true;
    }
    setCarDisplayName(car, player.name);
    car.visible = !player.finished;
  });
}

function smoothRemotePlayerCars(delta) {
  const positionSmoothing = 1 - Math.exp(-delta * 11);
  const headingSmoothing = 1 - Math.exp(-delta * 13);
  remotePlayerCars.forEach((car) => {
    if (!car.visible || !car.userData.targetPosition) return;
    car.position.lerp(car.userData.targetPosition, positionSmoothing);
    car.rotation.y = lerpAngle(car.rotation.y, car.userData.targetHeading, headingSmoothing);
  });
}

function setHoveredCar(car) {
  hoveredCar = car?.visible ? car : null;
  carHoverLabel.classList.toggle("is-visible", Boolean(hoveredCar));
  if (hoveredCar) {
    carHoverLabel.textContent = hoveredCar.userData.hoverName;
  }
}

function updateCarHoverLabel() {
  if (!hoveredCar || !hoveredCar.visible) {
    setHoveredCar(null);
    return;
  }
  carHoverLabel.textContent = hoveredCar.userData.hoverName;
  const labelPosition = hoveredCar.position.clone();
  labelPosition.y += 5.2;
  labelPosition.project(camera);
  if (labelPosition.z < -1 || labelPosition.z > 1) {
    carHoverLabel.classList.remove("is-visible");
    return;
  }
  carHoverLabel.classList.add("is-visible");
  carHoverLabel.style.left = `${((labelPosition.x + 1) / 2) * window.innerWidth}px`;
  carHoverLabel.style.top = `${((-labelPosition.y + 1) / 2) * window.innerHeight}px`;
}

function updateCarNameLabel(car, visible) {
  const label = ensureCarNameLabel(car);
  const shouldShow = visible && car.visible;
  label.classList.toggle("is-hidden", !shouldShow);
  if (!shouldShow) return;

  label.textContent = car.userData.hoverName;
  const labelPosition = car.position.clone();
  labelPosition.y += 6.3;
  labelPosition.project(camera);
  if (labelPosition.z < -1 || labelPosition.z > 1) {
    label.classList.add("is-hidden");
    return;
  }
  label.style.left = `${((labelPosition.x + 1) / 2) * window.innerWidth}px`;
  label.style.top = `${((-labelPosition.y + 1) / 2) * window.innerHeight}px`;
}

function updateCarNameLabels() {
  updateCarNameLabel(playerCar, raceState.mode === "singleplayer");
  singleplayerAiCars.forEach((car) => {
    updateCarNameLabel(car, false);
  });
  remotePlayerCars.forEach((car) => {
    updateCarNameLabel(car, raceState.mode === "multiplayer");
  });
}

function updateHoveredCar(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
  raycaster.setFromCamera(pointer, camera);
  const hoverCars = [playerCar, ...singleplayerAiCars, ...remotePlayerCars.values()];
  const hit = raycaster.intersectObjects(hoverCars, true).find((intersection) => {
    const car = intersection.object.userData.hoverCar;
    return car?.visible;
  });
  setHoveredCar(hit?.object.userData.hoverCar ?? null);
  updateCarHoverLabel();
}

function placeStartingGrid() {
  updateOpponentVisibility();
  if (raceState.mode === "multiplayer") {
    const localIndex = Math.max(
      0,
      raceState.players.findIndex((player) => player.id === raceState.playerId),
    );
    const localPlayer = getLocalPlayer();
    if (localPlayer?.carState) {
      applyCarStateToPlayerControl(localPlayer.carState);
    } else {
      applyCarStateToPlayerControl(getMultiplayerStartPose(localIndex));
    }
    renderRemotePlayerCars();
    return;
  }

  applyCarStateToPlayerControl(getSingleplayerStartPose(0));
  singleplayerAiCars.forEach((car, index) => {
    const pose = getSingleplayerStartPose(index + 1);
    car.position.set(pose.x, 0.24, pose.z);
    car.rotation.y = pose.heading + carModelRotationOffset;
  });
}

function addLighting() {
  const sun = new THREE.DirectionalLight(0xffffff, 2.05);
  sun.position.set(-72, 110, 64);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.00018;
  sun.shadow.normalBias = 0.035;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 260;
  sun.shadow.camera.left = -150;
  sun.shadow.camera.right = 150;
  sun.shadow.camera.top = 150;
  sun.shadow.camera.bottom = -150;
  scene.add(sun);

  scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x274722, 1.15));

  const lampMaterial = new THREE.MeshStandardMaterial({ color: 0x35383a, roughness: 0.5 });
  for (let i = 0; i < 14; i += 1) {
    const t = i / 14;
    const point = trackCurve.getPointAt(t);
    const tangent = trackCurve.getTangentAt(t).normalize();
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    point.addScaledVector(normal, i % 2 ? 19 : -19);

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 12, 10), lampMaterial);
    pole.position.set(point.x, 6, point.z);
    pole.castShadow = true;
    pole.receiveShadow = true;
    world.add(pole);

    const head = new THREE.PointLight(0xfff3be, 0.45, 24);
    head.position.set(point.x, 12.2, point.z);
    world.add(head);
  }
}

function formatRaceTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds - minutes * 60;
  return `${minutes}:${remainder.toFixed(1).padStart(4, "0")}`;
}

function formatPlacement(index) {
  const placements = ["1st", "2nd", "3rd", "4th", "5th"];
  return placements[index] ?? `${index + 1}th`;
}

function getPlayerColorHex(playerIndex) {
  return `#${multiplayerCarColors[playerIndex % multiplayerCarColors.length][0].toString(16).padStart(6, "0")}`;
}

function getSingleplayerResults() {
  const playerTime = raceState.finishTime || raceState.elapsed;
  const aiResults = singleplayerAiConfigs.map((config, index) => {
    const state = singleplayerAiStates[index];
    const remainingProgress = Math.max(raceState.totalLaps - (state?.progress ?? 0), 0);
    const currentMultiplier = Math.max(state?.speedMultiplier ?? 1, 0.48);
    const baseSpeed = getAiBaseSpeed(config, state);
    return {
      name: config.name,
      time: state?.finishTime || raceState.elapsed + remainingProgress / (baseSpeed * currentMultiplier),
    };
  });
  return [{ name: "You", time: playerTime }, ...aiResults].sort((a, b) => a.time - b.time);
}

function getMultiplayerResults() {
  return raceState.players
    .filter((player) => player.finished && Number.isFinite(player.finishTime))
    .sort((a, b) => a.finishTime - b.finishTime)
    .map((player) => ({
      name: player.name,
      time: player.finishTime,
      color: getPlayerColorHex(Math.max(0, raceState.players.findIndex((item) => item.id === player.id))),
    }));
}

function getProgressSinceStart(progress = gridStartProgress) {
  return (progress - gridStartProgress + 1) % 1;
}

function getPlayerRaceProgress(player) {
  if (player.id === raceState.playerId) {
    return raceState.lapsCompleted + getProgressSinceStart(playerControl.progress);
  }
  return (player.carState?.lapsCompleted ?? 0) + getProgressSinceStart(player.carState?.progress ?? gridStartProgress);
}

function getCurrentMultiplayerPlaceIndex() {
  if (raceState.mode !== "multiplayer" || !raceState.players.length || !raceState.playerId) return -1;
  const sortedPlayers = [...raceState.players].sort((a, b) => {
    if (a.finished && b.finished) return (a.finishTime ?? Infinity) - (b.finishTime ?? Infinity);
    if (a.finished) return -1;
    if (b.finished) return 1;
    const progressDelta = getPlayerRaceProgress(b) - getPlayerRaceProgress(a);
    if (Math.abs(progressDelta) > 0.0001) return progressDelta;
    return raceState.players.findIndex((player) => player.id === a.id) - raceState.players.findIndex((player) => player.id === b.id);
  });
  return sortedPlayers.findIndex((player) => player.id === raceState.playerId);
}

function getSingleplayerAiProgress(index) {
  const config = singleplayerAiConfigs[index];
  const state = singleplayerAiStates[index];
  const baseSpeed = getAiBaseSpeed(config, state);
  return Math.min(state.progress || (state.finished ? state.finishTime * baseSpeed : raceState.elapsed * baseSpeed), raceState.totalLaps);
}

function getCurrentSingleplayerPlaceIndex() {
  if (raceState.mode !== "singleplayer") return -1;
  const racers = [
    {
      id: "player",
      finished: raceState.finished,
      finishTime: raceState.finishTime || Infinity,
      progress: raceState.lapsCompleted + getProgressSinceStart(playerControl.progress),
    },
    ...singleplayerAiConfigs.map((config, index) => ({
      id: `ai-${index}`,
      finished: singleplayerAiStates[index].finished,
      finishTime: singleplayerAiStates[index].finishTime || Infinity,
      progress: getSingleplayerAiProgress(index),
    })),
  ];
  const sortedRacers = racers.sort((a, b) => {
    if (a.finished && b.finished) return a.finishTime - b.finishTime;
    if (a.finished) return -1;
    if (b.finished) return 1;
    return b.progress - a.progress;
  });
  return sortedRacers.findIndex((racer) => racer.id === "player");
}

function getCurrentPlaceIndex() {
  return raceState.mode === "multiplayer" ? getCurrentMultiplayerPlaceIndex() : getCurrentSingleplayerPlaceIndex();
}

function clearPlaceFeedback() {
  window.clearTimeout(placeFeedbackTimer);
  currentPlaceStat.classList.remove("place-gain", "place-loss");
}

function updatePlaceFeedback(placeIndex) {
  if (placeIndex === -1) {
    raceState.currentPlaceIndex = -1;
    clearPlaceFeedback();
    return;
  }

  if (raceState.currentPlaceIndex === -1) {
    raceState.currentPlaceIndex = placeIndex;
    return;
  }

  if (placeIndex === raceState.currentPlaceIndex) return;

  const flashClass = placeIndex < raceState.currentPlaceIndex ? "place-gain" : "place-loss";
  raceState.currentPlaceIndex = placeIndex;
  clearPlaceFeedback();
  void currentPlaceStat.offsetHeight;
  currentPlaceStat.classList.add(flashClass);
  placeFeedbackTimer = window.setTimeout(() => {
    currentPlaceStat.classList.remove(flashClass);
  }, 720);
}

function renderResults(results, mode) {
  endingTitle.textContent = mode === "multiplayer" ? "Final Standings" : "Singleplayer Results";
  resultsList.innerHTML = "";
  results.forEach((result, index) => {
    const item = document.createElement("li");
    item.classList.toggle("is-lower", mode === "multiplayer" && index >= 3);
    item.style.setProperty("--place-color", mode === "multiplayer" ? result.color : ["#ffd447", "#d9e2de", "#ffb16d"][index]);

    const place = document.createElement("span");
    place.className = "place";
    place.textContent = formatPlacement(index);

    const name = document.createElement("span");
    name.textContent = result.name;

    const time = document.createElement("span");
    time.className = "time";
    time.textContent = formatRaceTime(result.time);

    item.append(place, name, time);
    resultsList.append(item);
  });
}

function showEndingScreen(results, mode) {
  renderResults(results, mode);
  resultsReturnButton.hidden = mode !== "multiplayer";
  endingScreen.hidden = false;
  pauseModal.hidden = true;
  raceState.phase = "finished";
  raceState.started = false;
  raceState.finished = true;
  playerControl.handActive = false;
  updateGameUi();
  updateCheckpointVisibility();
  updateRaceHud();
}

function hideEndingScreen() {
  endingScreen.hidden = true;
}

function showHelpModal() {
  helpModal.hidden = false;
}

function hideHelpModal() {
  helpModal.hidden = true;
}

function showPauseMenu() {
  if (raceState.mode !== "singleplayer" || raceState.phase !== "racing") return;

  raceState.phase = "paused";
  raceState.pauseStartTime = getRaceClockTime();
  playerControl.handActive = false;
  playerControl.targetSpeed = 0;
  playerControl.targetSteer = 0;
  pauseModal.hidden = false;
  updateGameUi();
  updateCheckpointVisibility();
  updateRaceHud();
}

function resumePausedRace() {
  if (raceState.phase !== "paused") return;

  const pausedDuration = getRaceClockTime() - raceState.pauseStartTime;
  raceState.startTime += Math.max(pausedDuration, 0);
  raceState.pauseStartTime = 0;
  raceState.phase = "racing";
  pauseModal.hidden = true;
  updateGameUi();
  updateCheckpointVisibility();
  updateRaceHud();
}

function exitPausedRace() {
  pauseModal.hidden = true;
  showMainMenu();
}

async function returnToMultiplayerLobby() {
  const room = getStoredRoom();
  if (!room) {
    showMainMenu();
    return;
  }
  const result = await requestMultiplayerAction("resetLobby", {
    roomCode: raceState.roomCode,
    startStates: getMultiplayerStartStates(room.players),
  });

  if (!result.ok) {
    showMainMenu();
    return;
  }

  hideEndingScreen();
  multiplayerRoomsCache = result.rooms ?? multiplayerRoomsCache;
  raceState.mode = "multiplayer";
  raceState.phase = "multiplayer-config";
  raceState.players = result.room.players;
  raceState.isLeader = Boolean(getLocalPlayer()?.leader);
  resetRaceState();
  raceState.mode = "multiplayer";
  raceState.phase = "multiplayer-config";
  raceState.players = result.room.players;
  raceState.isLeader = Boolean(getLocalPlayer()?.leader);
  multiplayerConfigForm.dataset.step = "lobby";
  multiplayerMessage.classList.remove("is-visible");
  activeRoomCodeLabel.textContent = raceState.roomCode;
  applyLocalMultiplayerIdentity();
  renderRemotePlayerCars();
  renderRoomLobby();
  updateGameUi();
}

function resetPlayerAtStart() {
  playerControl.speed = 0;
  playerControl.targetSpeed = 0;
  playerControl.steer = 0;
  playerControl.targetSteer = 0;
  playerControl.handActive = false;
  placeStartingGrid();
}

function resetRaceState() {
  raceState.lapsCompleted = 0;
  raceState.nextCheckpoint = 1;
  raceState.lastCheckpoint = startCheckpointIndex;
  raceState.started = false;
  raceState.finished = false;
  raceState.startTime = 0;
  raceState.elapsed = 0;
  raceState.finishTime = 0;
  raceState.checkpointCooldown = 0.75;
  raceState.countdownRemaining = raceState.countdownDuration;
  raceState.pauseStartTime = 0;
  raceState.spectatingPlayerId = "";
  raceState.currentPlaceIndex = -1;
  raceState.wrongWayTimer = 0;
  raceState.wrongWayDistance = 0;
  raceState.wrongWayTeleportGrace = 0;
  raceState.wrongWayPreviousProgress = null;
  singleplayerAiStates.forEach((state, index) => {
    state.finished = false;
    state.finishTime = 0;
    state.progress = 0;
    state.speedMultiplier = 1;
    state.difficultyMultiplier = getAiDifficultyMultiplier(singleplayerAiConfigs[index]);
  });
  clearPlaceFeedback();
  spectatorSwitchCooldown = 0;
  playerCar.visible = true;
  resetPlayerAtStart();
}

function updateGameUi() {
  document.body.dataset.racePhase = raceState.phase;
  document.body.dataset.raceMode = raceState.mode;
  gameMenu.dataset.state = raceState.phase === "finished" ? "menu" : raceState.phase;
  countdownLabel.textContent = String(Math.max(Math.ceil(raceState.countdownRemaining), 0));
  updateOpponentVisibility();
}

function updateCheckpointVisibility() {
  checkpointMeshes.forEach((mesh, index) => {
    mesh.visible =
      raceState.phase === "racing" &&
      !raceState.finished &&
      index !== startCheckpointIndex &&
      index === raceState.nextCheckpoint;
  });
}

function updateRaceHud() {
  const lapsLeft = Math.max(raceState.totalLaps - raceState.lapsCompleted, 0);
  const isCompleted = raceState.finished && raceState.mode === "multiplayer";
  const placeIndex = getCurrentPlaceIndex();
  const speedRatio = THREE.MathUtils.clamp(Math.abs(playerControl.speed) / handControlGuide.maxSpeed, 0, 1);
  const speedKmh = Math.round(Math.abs(playerControl.speed) * speedometerScale);
  const speedHue = THREE.MathUtils.lerp(78, 0, Math.pow(speedRatio, 1.7));
  const speedGlow = THREE.MathUtils.lerp(0.2, 0.78, Math.pow(speedRatio, 2.2));
  lapsLeftLabel.textContent = isCompleted ? "Completed" : raceState.finished ? "Win" : String(lapsLeft);
  lapsStatusLabel.textContent = isCompleted ? "status" : "laps left";
  speedValueLabel.textContent = String(speedKmh);
  speedStat.style.setProperty("--speed-color", `hsl(${speedHue} 92% 58%)`);
  speedStat.style.setProperty("--speed-glow", `rgba(255, 58, 58, ${speedGlow})`);
  currentPlaceStat.hidden = raceState.phase !== "racing";
  currentPlaceLabel.textContent = placeIndex === -1 ? "-" : formatPlacement(placeIndex);
  if (raceState.phase === "racing") {
    updatePlaceFeedback(placeIndex);
  } else {
    raceState.currentPlaceIndex = placeIndex;
    clearPlaceFeedback();
  }
  raceTimerLabel.textContent = formatRaceTime(raceState.elapsed);
}

function showCheckpointFeedback(message) {
  if (!checkpointFeedback) return;

  window.clearTimeout(checkpointFeedbackTimer);
  checkpointFeedback.textContent = message;
  checkpointFeedback.classList.remove("is-wrong-way", "is-teleporting");
  checkpointFeedback.classList.add("is-visible");
  checkpointFeedbackTimer = window.setTimeout(() => {
    checkpointFeedback.classList.remove("is-visible");
  }, 1450);
}

function showWrongWayFeedback(message, isTeleporting = false) {
  if (!checkpointFeedback) return;

  window.clearTimeout(checkpointFeedbackTimer);
  checkpointFeedback.textContent = message;
  checkpointFeedback.classList.toggle("is-teleporting", isTeleporting);
  checkpointFeedback.classList.add("is-visible", "is-wrong-way");
}

function clearWrongWayFeedback() {
  if (!checkpointFeedback?.classList.contains("is-wrong-way")) return;

  checkpointFeedback.classList.remove("is-visible", "is-wrong-way", "is-teleporting");
}

function showConfettiFeedback(origin) {
  const colors = [0xd7f86e, 0x3bb7ff, 0xffd447, 0xe23d35, 0xffffff];
  const geometry = new THREE.BoxGeometry(0.35, 0.12, 0.8);
  const pieces = [];

  for (let i = 0; i < 54; i += 1) {
    const material = new THREE.MeshBasicMaterial({
      color: colors[i % colors.length],
      transparent: true,
      opacity: 0.95,
    });
    const piece = new THREE.Mesh(geometry, material);
    const angle = Math.random() * Math.PI * 2;
    const speed = 10 + Math.random() * 18;
    piece.position.copy(origin);
    piece.position.y += 1.2 + Math.random() * 1.8;
    piece.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    piece.userData.velocity = new THREE.Vector3(Math.cos(angle) * speed, 12 + Math.random() * 13, Math.sin(angle) * speed);
    piece.userData.spin = new THREE.Vector3(Math.random() * 8, Math.random() * 10, Math.random() * 8);
    world.add(piece);
    pieces.push(piece);
  }

  confettiBursts.push({ pieces, age: 0, duration: 1.35 });
}

function updateConfettiBursts(delta) {
  for (let burstIndex = confettiBursts.length - 1; burstIndex >= 0; burstIndex -= 1) {
    const burst = confettiBursts[burstIndex];
    burst.age += delta;
    const fade = Math.max(0, 1 - burst.age / burst.duration);

    burst.pieces.forEach((piece) => {
      piece.userData.velocity.y -= 24 * delta;
      piece.position.addScaledVector(piece.userData.velocity, delta);
      piece.rotation.x += piece.userData.spin.x * delta;
      piece.rotation.y += piece.userData.spin.y * delta;
      piece.rotation.z += piece.userData.spin.z * delta;
      piece.material.opacity = fade;
    });

    if (burst.age >= burst.duration) {
      burst.pieces.forEach((piece) => {
        world.remove(piece);
        piece.material.dispose();
      });
      burst.pieces[0]?.geometry.dispose();
      confettiBursts.splice(burstIndex, 1);
    }
  }
}

function startRace(now = getRaceClockTime()) {
  raceState.phase = "racing";
  raceState.started = true;
  raceState.finished = false;
  raceState.startTime = now;
  raceState.elapsed = 0;
  raceState.finishTime = 0;
  raceState.checkpointCooldown = 0.75;
  resetWrongWayTracker();
  setCameraMode("chase");
  if (!webcamStream) {
    setHandStatus("waiting for driver cam");
  }
  updateLocalMultiplayerCarState(true);
  updateGameUi();
  updateCheckpointVisibility();
  updateRaceHud();
}

function getUnfinishedRemotePlayers() {
  return raceState.players.filter((player) => player.id !== raceState.playerId && !player.finished);
}

function selectSpectatorTarget(direction = 1) {
  const candidates = getUnfinishedRemotePlayers();
  if (!candidates.length) {
    raceState.spectatingPlayerId = "";
    return;
  }

  const currentIndex = candidates.findIndex((player) => player.id === raceState.spectatingPlayerId);
  const nextIndex = currentIndex === -1 ? 0 : (currentIndex + direction + candidates.length) % candidates.length;
  raceState.spectatingPlayerId = candidates[nextIndex].id;
  setHandStatus(`spectating ${candidates[nextIndex].name}`);
}

function updateSpectatorControls(hands) {
  const trackedHands = getTrackedHands(hands);
  const now = getRaceClockTime();
  const closedHands = trackedHands.filter((hand) => hand.closedScore >= handControlGuide.fistThreshold);
  if (closedHands.length && now >= spectatorSwitchCooldown) {
    const rightSideClosed = closedHands.some((hand) => hand.visualX >= 0.5);
    selectSpectatorTarget(rightSideClosed ? 1 : -1);
    spectatorSwitchCooldown = now + 0.65;
  }

  if (!raceState.spectatingPlayerId) {
    selectSpectatorTarget(1);
  }

  playerControl.handActive = false;
  playerControl.speed = 0;
  playerControl.targetSpeed = 0;
  playerControl.steer = 0;
  playerControl.targetSteer = 0;
  return {
    available: true,
    trackedHands,
  };
}

function finishMultiplayerRace() {
  raceState.finishTime = raceState.elapsed;
  raceState.finished = true;
  raceState.started = false;
  playerControl.handActive = false;
  playerControl.speed = 0;
  playerControl.targetSpeed = 0;
  playerControl.steer = 0;
  playerControl.targetSteer = 0;
  playerCar.visible = false;

  const carState = getPlayerCarState();
  const room = getStoredRoom();
  if (room) {
    const updatedRoom = {
      ...room,
      players: room.players.map((player) =>
        player.id === raceState.playerId
          ? { ...player, finished: true, finishTime: raceState.finishTime, carState }
          : player,
      ),
    };
    multiplayerRoomsCache = { ...getStoredRooms(), [raceState.roomCode]: updatedRoom };
    raceState.players = updatedRoom.players;
  }
  sendMultiplayerMessage({
    type: "updatePlayerState",
    roomCode: raceState.roomCode,
    playerId: raceState.playerId,
    carState,
    finished: true,
    finishTime: raceState.finishTime,
  });

  renderRemotePlayerCars();
  const allFinished = raceState.players.length > 0 && raceState.players.every((player) => player.finished);
  if (allFinished) {
    showEndingScreen(getMultiplayerResults(), "multiplayer");
    return;
  }

  selectSpectatorTarget(1);
  showCheckpointFeedback("Finished - spectating");
  updateGameUi();
  updateCheckpointVisibility();
  updateRaceHud();
}

function beginCountdown(mode = "singleplayer") {
  hideEndingScreen();
  hideHelpModal();
  pauseModal.hidden = true;
  resetRaceState();
  raceState.mode = mode;
  raceState.phase = "countdown";
  raceState.countdownStartTime = getRaceClockTime();
  raceState.countdownRemaining = raceState.countdownDuration;
  setCameraMode("chase");
  setHandStatus("starting");
  if (!webcamStream) {
    void startWebcam();
  }
  updateGameUi();
  updateCheckpointVisibility();
  updateRaceHud();
}

function beginSharedMultiplayerCountdown(startedAt) {
  if (raceState.phase === "countdown" || raceState.phase === "racing") return;
  pauseModal.hidden = true;
  resetRaceState();
  raceState.mode = "multiplayer";
  raceState.phase = "countdown";
  const countdownElapsed = Math.max(0, (Date.now() - startedAt) / 1000);
  raceState.countdownStartTime = getRaceClockTime() - countdownElapsed;
  raceState.countdownRemaining = Math.max(0, raceState.countdownDuration - countdownElapsed);
  setCameraMode("chase");
  setHandStatus("starting");
  if (!webcamStream) {
    void startWebcam();
  }
  updateGameUi();
  updateCheckpointVisibility();
  updateRaceHud();
}

function showMultiplayerConfig() {
  hideEndingScreen();
  hideHelpModal();
  pauseModal.hidden = true;
  raceState.mode = "multiplayer";
  raceState.phase = "multiplayer-config";
  resetRaceState();
  raceState.mode = "multiplayer";
  raceState.phase = "multiplayer-config";
  raceState.isLeader = false;
  raceState.players = [];
  multiplayerConfigForm.dataset.step = "choose";
  multiplayerMessage.classList.remove("is-visible");
  activeRoomCodeLabel.textContent = "----";
  roomPlayerList.innerHTML = "";
  readyToggleButton.textContent = "Ready";
  startMultiplayerButton.hidden = false;
  startMultiplayerButton.disabled = true;
  updateGameUi();
}

function showMainMenu() {
  leaveLobbyIfNeeded();
  hideEndingScreen();
  hideHelpModal();
  pauseModal.hidden = true;
  raceState.mode = "singleplayer";
  raceState.phase = "menu";
  resetRaceState();
  raceState.mode = "singleplayer";
  raceState.phase = "menu";
  updateGameUi();
}

function showMultiplayerMessage(message) {
  multiplayerMessage.textContent = message;
  multiplayerMessage.classList.add("is-visible");
}

function getPlayerName() {
  return playerNameInput.value.trim();
}

function getPlayerId() {
  if (!raceState.playerId) {
    raceState.playerId =
      crypto.randomUUID?.() ?? `player-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
  return raceState.playerId;
}

function getStoredRooms() {
  if (Object.keys(multiplayerRoomsCache).length) {
    return multiplayerRoomsCache;
  }
  try {
    multiplayerRoomsCache = JSON.parse(localStorage.getItem(multiplayerStorageKey)) ?? {};
    return multiplayerRoomsCache;
  } catch (error) {
    console.warn("Could not read multiplayer rooms:", error);
    return {};
  }
}

function sendMultiplayerMessage(message) {
  if (!multiplayerSocketConnected || multiplayerSocket?.readyState !== WebSocket.OPEN) return false;
  multiplayerSocket.send(JSON.stringify(message));
  return true;
}

function requestMultiplayerAction(type, payload = {}) {
  const requestId = crypto.randomUUID?.() ?? `request-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return new Promise((resolve) => {
    if (!sendMultiplayerMessage({ type, requestId, ...payload })) {
      resolve({ ok: false, message: "Multiplayer server is not connected." });
      return;
    }

    const timeout = window.setTimeout(() => {
      multiplayerPendingRequests.delete(requestId);
      resolve({ ok: false, message: "Multiplayer server did not respond." });
    }, 2500);
    multiplayerPendingRequests.set(requestId, { resolve, timeout });
  });
}

function registerMultiplayerSession() {
  if (!raceState.roomCode || !raceState.playerId || raceState.mode !== "multiplayer") return;
  sendMultiplayerMessage({ type: "registerPlayer", roomCode: raceState.roomCode, playerId: raceState.playerId });
}

function saveStoredRooms(rooms) {
  multiplayerRoomsCache = rooms;
  localStorage.setItem(multiplayerStorageKey, JSON.stringify(rooms));
  multiplayerRoomChannel?.postMessage({ type: "rooms-updated" });
  sendMultiplayerMessage({ type: "saveRooms", rooms });
}

function getStoredRoom(roomCode = raceState.roomCode) {
  return getStoredRooms()[roomCode];
}

function createRoomCode(existingRooms = getStoredRooms()) {
  let code = "";
  do {
    code = Math.random().toString(36).slice(2, 6).toUpperCase();
  } while (existingRooms[code]);
  return code;
}

function normalizeRoomPlayers(players) {
  if (!players.length) return [];
  const leaderIndex = players.findIndex((player) => player.leader);
  const nextLeaderIndex = leaderIndex === -1 ? 0 : leaderIndex;
  return players.map((player, index) => ({
    ...player,
    leader: index === nextLeaderIndex,
    ready: index === nextLeaderIndex ? true : player.ready,
  }));
}

function resetRoomPlayersForGrid(players) {
  return normalizeRoomPlayers(players).map((player, index) => ({
    ...player,
    finished: false,
    finishTime: null,
    carState: getMultiplayerStartPose(index),
  }));
}

function getMultiplayerStartStates(players) {
  return Object.fromEntries(resetRoomPlayersForGrid(players).map((player) => [player.id, player.carState]));
}

function updateStoredRoom(roomCode, updater) {
  const rooms = getStoredRooms();
  const room = rooms[roomCode];
  if (!room) return null;
  const updatedRoom = updater(room);
  if (updatedRoom.players) {
    updatedRoom.players = normalizeRoomPlayers(updatedRoom.players);
  }
  rooms[roomCode] = updatedRoom;
  saveStoredRooms(rooms);
  return updatedRoom;
}

function leaveCurrentMultiplayerRoom() {
  if (!raceState.roomCode || !raceState.playerId || raceState.mode !== "multiplayer") return;
  if (sendMultiplayerMessage({ type: "leaveRoom", roomCode: raceState.roomCode, playerId: raceState.playerId })) {
    return;
  }
  const rooms = getStoredRooms();
  const room = rooms[raceState.roomCode];
  if (!room) return;

  const remainingPlayers = normalizeRoomPlayers(room.players.filter((player) => player.id !== raceState.playerId));
  if (!remainingPlayers.length) {
    delete rooms[raceState.roomCode];
  } else {
    rooms[raceState.roomCode] = {
      ...room,
      players: remainingPlayers,
    };
  }
  saveStoredRooms(rooms);
}

function leaveLobbyIfNeeded() {
  const isInLobby = raceState.mode === "multiplayer" && multiplayerConfigForm.dataset.step === "lobby";
  if (isInLobby && raceState.phase === "multiplayer-config") {
    leaveCurrentMultiplayerRoom();
  }
}

function syncCurrentRoom() {
  if (raceState.mode === "multiplayer" && multiplayerConfigForm.dataset.step === "join") {
    renderAvailableLobbies();
  }
  const isActiveRoomView =
    multiplayerConfigForm.dataset.step === "lobby" || raceState.phase === "countdown" || raceState.phase === "racing";
  if (!raceState.roomCode || raceState.mode !== "multiplayer" || !isActiveRoomView) return;
  const room = getStoredRoom();
  if (!room) {
    showMultiplayerConfig();
    showMultiplayerMessage("Room closed.");
    return;
  }
  raceState.players = room.players;
  raceState.isLeader = Boolean(getLocalPlayer()?.leader);
  applyLocalMultiplayerIdentity();
  renderRemotePlayerCars();
  const allFinished = raceState.players.length > 0 && raceState.players.every((player) => player.finished);
  if (allFinished && raceState.phase !== "finished") {
    showEndingScreen(getMultiplayerResults(), "multiplayer");
    return;
  }
  if (raceState.finished && raceState.mode === "multiplayer") {
    const spectatedPlayer = raceState.players.find((player) => player.id === raceState.spectatingPlayerId);
    if (!spectatedPlayer || spectatedPlayer.finished) {
      selectSpectatorTarget(1);
    }
  }
  if (room.started && room.startedAt) {
    beginSharedMultiplayerCountdown(room.startedAt);
    return;
  }
  if (multiplayerConfigForm.dataset.step === "lobby") {
    renderRoomLobby();
  }
}

function renderRoomLobby() {
  activeRoomCodeLabel.textContent = raceState.roomCode;
  roomPlayerList.innerHTML = "";
  raceState.players.forEach((player) => {
    const item = document.createElement("li");
    item.classList.toggle("is-ready", player.ready);
    item.textContent = player.leader ? `${player.name} (Leader)` : player.name;
    const status = document.createElement("span");
    status.textContent = player.ready ? "Ready" : "Waiting";
    item.append(status);
    roomPlayerList.append(item);
  });
  const localPlayer = raceState.players.find((player) => player.id === raceState.playerId);
  raceState.isLeader = Boolean(localPlayer?.leader);
  const otherPlayers = raceState.players.filter((player) => !player.leader);
  const allOtherPlayersReady = otherPlayers.length > 0 && otherPlayers.every((player) => player.ready);
  readyToggleButton.hidden = raceState.isLeader;
  readyToggleButton.textContent = localPlayer?.ready ? "Unready" : "Ready";
  leaderWaitingMessage.classList.toggle("is-visible", raceState.isLeader && otherPlayers.length === 0);
  startMultiplayerButton.hidden = !raceState.isLeader;
  startMultiplayerButton.disabled = !raceState.isLeader || !allOtherPlayersReady;
}

function getJoinableLobbyEntries() {
  const rooms = getStoredRooms();
  return Object.values(rooms)
    .map((room) => ({
      ...room,
      players: normalizeRoomPlayers(room.players ?? []),
    }))
    .filter((room) => !room.started)
    .sort((a, b) => a.code.localeCompare(b.code));
}

function selectLobby(roomCode) {
  selectedLobbyCode = roomCode;
  roomCodeInput.value = roomCode;
  multiplayerMessage.classList.remove("is-visible");
  renderAvailableLobbies();
}

function renderAvailableLobbies() {
  if (!availableLobbyList) return;

  const lobbies = getJoinableLobbyEntries();
  if (selectedLobbyCode && !lobbies.some((room) => room.code === selectedLobbyCode)) {
    selectedLobbyCode = "";
  }

  availableLobbiesCount.textContent = `${lobbies.length} ${lobbies.length === 1 ? "room" : "rooms"}`;
  availableLobbyList.innerHTML = "";

  if (!lobbies.length) {
    const emptyState = document.createElement("p");
    emptyState.className = "available-lobby-empty";
    emptyState.textContent = "No open lobbies.";
    availableLobbyList.append(emptyState);
    return;
  }

  lobbies.forEach((room) => {
    const players = room.players ?? [];
    const isFull = players.length >= maxMultiplayerPlayers;
    const leader = players.find((player) => player.leader) ?? players[0];
    const button = document.createElement("button");
    button.type = "button";
    button.className = "available-lobby-card";
    button.classList.toggle("is-selected", selectedLobbyCode === room.code);
    button.classList.toggle("is-full", isFull);
    button.dataset.roomCode = room.code;
    const lobbyText = document.createElement("span");
    const lobbyCode = document.createElement("strong");
    const lobbyLeader = document.createElement("em");
    const lobbyCount = document.createElement("b");
    lobbyCode.textContent = room.code;
    lobbyLeader.textContent = leader?.name ?? "Open lobby";
    lobbyCount.textContent = `${players.length}/${maxMultiplayerPlayers}`;
    lobbyText.append(lobbyCode, lobbyLeader);
    button.append(lobbyText, lobbyCount);
    button.addEventListener("click", () => selectLobby(room.code));
    availableLobbyList.append(button);
  });
}

function enterLobby({ roomCode, isLeader, players }) {
  raceState.roomCode = roomCode.toUpperCase();
  raceState.isLeader = isLeader;
  raceState.players = players;
  playerNameInput.value = raceState.playerName;
  roomCodeInput.value = isLeader ? "" : raceState.roomCode;
  multiplayerMessage.classList.remove("is-visible");
  multiplayerConfigForm.dataset.step = "lobby";
  registerMultiplayerSession();
  applyLocalMultiplayerIdentity();
  renderRemotePlayerCars();
  renderRoomLobby();
}

async function createMultiplayerRoom() {
  const playerName = getPlayerName();
  if (!playerName) {
    showMultiplayerMessage("Enter your name before creating a room.");
    return;
  }
  raceState.playerName = playerName;
  const leader = {
    id: getPlayerId(),
    name: raceState.playerName,
    ready: true,
    leader: true,
    carState: getMultiplayerStartPose(0),
  };
  const result = await requestMultiplayerAction("createRoom", { player: leader });
  if (!result.ok) {
    showMultiplayerMessage(result.message ?? "Could not create room.");
    return;
  }
  multiplayerRoomsCache = result.rooms ?? multiplayerRoomsCache;
  enterLobby({ roomCode: result.roomCode, isLeader: true, players: result.room.players });
}

function showJoinRoom() {
  const playerName = getPlayerName();
  if (!playerName) {
    showMultiplayerMessage("Enter your name before joining a room.");
    return;
  }
  raceState.playerName = playerName;
  playerNameInput.value = raceState.playerName;
  multiplayerConfigForm.dataset.step = "join";
  multiplayerMessage.classList.remove("is-visible");
  renderAvailableLobbies();
  roomCodeInput.focus();
}

function pressRoomCodeKey(key) {
  const currentCode = roomCodeInput.value.trim().toUpperCase();
  selectedLobbyCode = "";
  if (key === "backspace") {
    roomCodeInput.value = currentCode.slice(0, -1);
  } else if (key === "clear") {
    roomCodeInput.value = "";
  } else if (currentCode.length < Number(roomCodeInput.maxLength || 12)) {
    roomCodeInput.value = `${currentCode}${key}`.slice(0, Number(roomCodeInput.maxLength || 12));
  }
  roomCodeInput.focus();
  multiplayerMessage.classList.remove("is-visible");
  renderAvailableLobbies();
}

function returnToMultiplayerChoices() {
  multiplayerConfigForm.dataset.step = "choose";
  multiplayerMessage.classList.remove("is-visible");
  roomCodeInput.value = "";
  selectedLobbyCode = "";
  renderAvailableLobbies();
  activeRoomCodeLabel.textContent = "----";
  roomPlayerList.innerHTML = "";
  readyToggleButton.textContent = "Ready";
  startMultiplayerButton.hidden = false;
  startMultiplayerButton.disabled = true;
}

function handleMultiplayerBack() {
  if (multiplayerConfigForm.dataset.step === "join") {
    returnToMultiplayerChoices();
    return;
  }
  showMainMenu();
}

async function joinMultiplayerRoom() {
  const playerName = raceState.playerName;
  const typedRoomCode = roomCodeInput.value.trim().toUpperCase();
  const roomCode = selectedLobbyCode || typedRoomCode;
  if (!roomCode) {
    showMultiplayerMessage("Enter a room code or select a lobby.");
    return;
  }
  if (!playerName) {
    showMultiplayerMessage("Enter your name before joining a room.");
    return;
  }
  raceState.playerName = playerName;
  const playerId = getPlayerId();
  const result = await requestMultiplayerAction("joinRoom", {
    roomCode,
    player: {
      id: playerId,
      name: raceState.playerName,
      ready: false,
      leader: false,
      carState: getMultiplayerStartPose(0),
    },
  });
  if (!result.ok) {
    showMultiplayerMessage(result.message ?? "Could not join room.");
    renderAvailableLobbies();
    return;
  }
  multiplayerRoomsCache = result.rooms ?? multiplayerRoomsCache;
  enterLobby({ roomCode: result.roomCode, isLeader: false, players: result.room.players });
  if (result.room.started && result.room.startedAt) {
    beginSharedMultiplayerCountdown(result.room.startedAt);
  }
}

async function toggleReady() {
  const result = await requestMultiplayerAction("toggleReady", {
    roomCode: raceState.roomCode,
    playerId: raceState.playerId,
  });
  if (!result.ok) {
    showMultiplayerMessage(result.message ?? "Could not update ready state.");
    return;
  }
  multiplayerRoomsCache = result.rooms ?? multiplayerRoomsCache;
  raceState.players = result.room.players;
  renderRoomLobby();
}

async function startConfiguredMultiplayer() {
  if (!raceState.isLeader) {
    showMultiplayerMessage("Only the room leader can start.");
    return;
  }
  const room = getStoredRoom();
  if (!room) {
    showMultiplayerMessage("Room closed.");
    return;
  }
  raceState.players = room.players;
  const otherPlayers = raceState.players.filter((player) => !player.leader);
  if (!otherPlayers.length) {
    showMultiplayerMessage("Waiting for other players.");
    renderRoomLobby();
    return;
  }
  if (!otherPlayers.every((player) => player.ready)) {
    showMultiplayerMessage("Waiting for other players to be ready.");
    renderRoomLobby();
    return;
  }
  const startedAt = Date.now();
  const result = await requestMultiplayerAction("startRace", {
    roomCode: raceState.roomCode,
    playerId: raceState.playerId,
    startedAt,
    startStates: getMultiplayerStartStates(room.players),
  });
  if (!result.ok) {
    showMultiplayerMessage(result.message ?? "Could not start race.");
    renderRoomLobby();
    return;
  }
  multiplayerRoomsCache = result.rooms ?? multiplayerRoomsCache;
  raceState.players = result.room.players;
  applyLocalMultiplayerIdentity();
  renderRemotePlayerCars();
  beginSharedMultiplayerCountdown(startedAt);
}

function completeCurrentCheckpoint() {
  const reachedCheckpoint = raceState.nextCheckpoint;
  const reachedCheckpointPosition = checkpointMeshes[reachedCheckpoint]?.position.clone();
  raceState.checkpointCooldown = 0.75;
  raceState.lastCheckpoint = reachedCheckpoint;
  resetWrongWayTracker();

  if (raceState.nextCheckpoint === startCheckpointIndex) {
    raceState.lapsCompleted += 1;
    raceState.nextCheckpoint = 1;
  } else {
    raceState.nextCheckpoint += 1;
    if (raceState.nextCheckpoint >= checkpointDefinitions.length) {
      raceState.nextCheckpoint = startCheckpointIndex;
    }
  }

  if (raceState.lapsCompleted >= raceState.totalLaps) {
    if (raceState.mode === "multiplayer") {
      finishMultiplayerRace();
    } else {
      raceState.finishTime = raceState.elapsed;
      raceState.finished = true;
      raceState.started = false;
      playerControl.handActive = false;
      playerControl.speed = 0;
      playerControl.targetSpeed = 0;
      playerControl.steer = 0;
      playerControl.targetSteer = 0;
      setHandStatus("winner");
      showEndingScreen(getSingleplayerResults(), "singleplayer");
      showCheckpointFeedback("Race complete");
    }
  } else if (reachedCheckpoint === startCheckpointIndex) {
    showConfettiFeedback(reachedCheckpointPosition ?? playerControl.position);
  } else {
    showConfettiFeedback(reachedCheckpointPosition ?? playerControl.position);
  }

  updateCheckpointVisibility();
  updateRaceHud();
}

function updateCheckpointProgress(delta) {
  if (!raceState.started || raceState.finished) return;

  raceState.checkpointCooldown = Math.max(0, raceState.checkpointCooldown - delta);
  if (raceState.checkpointCooldown > 0) return;

  const checkpoint = checkpointMeshes[raceState.nextCheckpoint];
  const distance = Math.hypot(
    playerControl.position.x - checkpoint.position.x,
    playerControl.position.z - checkpoint.position.z,
  );

  if (distance <= checkpointRadius) {
    completeCurrentCheckpoint();
  }
}

function updateSingleplayerAiCars(delta) {
  if (raceState.mode !== "singleplayer" || raceState.phase !== "racing") return;

  const playerProgress = raceState.lapsCompleted + getProgressSinceStart(playerControl.progress);

  singleplayerAiCars.forEach((car, index) => {
    const state = singleplayerAiStates[index];
    const config = singleplayerAiConfigs[index];
    if (state.finished) {
      car.visible = false;
      return;
    }

    const targetGap = THREE.MathUtils.clamp((index - 2) * 0.045, -0.1, 0.1);
    const gapToPlayer = state.progress - playerProgress - targetGap;
    const targetMultiplier = THREE.MathUtils.clamp(1 - gapToPlayer * 1.85, 0.48, 1.62);
    state.speedMultiplier = THREE.MathUtils.lerp(state.speedMultiplier, targetMultiplier, 1 - Math.exp(-delta * 1.6));
    state.progress = Math.min(state.progress + getAiBaseSpeed(config, state) * state.speedMultiplier * delta, raceState.totalLaps);

    if (state.progress >= raceState.totalLaps) {
      state.finished = true;
      state.finishTime = raceState.elapsed;
      car.visible = false;
      return;
    }

    const startPose = getSingleplayerStartPose(index + 1);
    placeCar(car, (gridStartProgress + state.progress) % 1, startPose.lane);
  });
}

function connectMultiplayerServer() {
  if (!("WebSocket" in window)) return;

  const configuredMultiplayerUrl = import.meta.env.VITE_MULTIPLAYER_URL?.trim();
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const multiplayerUrl = configuredMultiplayerUrl || `${protocol}//${window.location.host}/multiplayer`;
  const socket = new WebSocket(multiplayerUrl);
  multiplayerSocket = socket;

  socket.addEventListener("open", () => {
    multiplayerSocketConnected = true;
    sendMultiplayerMessage({ type: "sync" });
    registerMultiplayerSession();
  });

  socket.addEventListener("message", (event) => {
    try {
      const message = JSON.parse(event.data);
      if (message.type === "actionResult") {
        if (message.rooms) {
          multiplayerRoomsCache = message.rooms;
          localStorage.setItem(multiplayerStorageKey, JSON.stringify(multiplayerRoomsCache));
        }
        const pendingRequest = multiplayerPendingRequests.get(message.requestId);
        if (pendingRequest) {
          window.clearTimeout(pendingRequest.timeout);
          multiplayerPendingRequests.delete(message.requestId);
          pendingRequest.resolve(message);
        }
        syncCurrentRoom();
        return;
      }
      if (message.type !== "rooms") return;
      multiplayerRoomsCache = message.rooms ?? {};
      localStorage.setItem(multiplayerStorageKey, JSON.stringify(multiplayerRoomsCache));
      syncCurrentRoom();
    } catch (error) {
      console.warn("Could not sync multiplayer rooms:", error);
    }
  });

  socket.addEventListener("close", () => {
    multiplayerSocketConnected = false;
    multiplayerPendingRequests.forEach((pendingRequest) => {
      window.clearTimeout(pendingRequest.timeout);
      pendingRequest.resolve({ ok: false, message: "Multiplayer server disconnected." });
    });
    multiplayerPendingRequests.clear();
    if (multiplayerSocket === socket) {
      window.setTimeout(connectMultiplayerServer, 1800);
    }
  });

  socket.addEventListener("error", () => {
    multiplayerSocketConnected = false;
  });
}

addGround();
addTrack();
addPitLane();
addTrackFurniture();
addStandsAndProps();
addLighting();
connectMultiplayerServer();
updateGameUi();
updateCheckpointVisibility();
updateRaceHud();
resetPlayerAtStart();

const webcamStates = {
  idle: {
    status: "Off",
    message: "Ready",
    canStart: true,
    canStop: false,
  },
  loading: {
    status: "Loading",
    message: "Waiting for camera permission...",
    canStart: false,
    canStop: false,
  },
  live: {
    status: "Live",
    message: "",
    canStart: false,
    canStop: true,
  },
  denied: {
    status: "Blocked",
    message: "Camera permission denied.",
    canStart: true,
    canStop: false,
  },
  "no-camera": {
    status: "No camera",
    message: "No camera found.",
    canStart: true,
    canStop: false,
  },
  busy: {
    status: "Busy",
    message: "Camera is already in use.",
    canStart: true,
    canStop: false,
  },
  unavailable: {
    status: "Unavailable",
    message: "Camera access is unavailable here.",
    canStart: false,
    canStop: false,
  },
  error: {
    status: "Error",
    message: "Camera could not start.",
    canStart: true,
    canStop: false,
  },
};

function setWebcamState(state, messageOverride) {
  const nextState = webcamStates[state] ?? webcamStates.error;
  webcamPanel.dataset.state = state;
  webcamStatus.textContent = nextState.status;
  webcamMessage.textContent = messageOverride ?? nextState.message;
  if (webcamStartButton) {
    webcamStartButton.disabled = !nextState.canStart;
    webcamStartButton.classList.toggle("active", nextState.canStart);
  }
  if (webcamStopButton) {
    webcamStopButton.disabled = !nextState.canStop;
    webcamStopButton.classList.toggle("active", nextState.canStop);
  }
}

function setHandStatus(message) {
  handStatus.textContent = `Controls: ${message}`;
}

function getLandmarkDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function getHandCenter(landmarks) {
  return [0, 5, 9, 13, 17].reduce(
    (center, index) => {
      center.x += landmarks[index].x / 5;
      center.y += landmarks[index].y / 5;
      return center;
    },
    { x: 0, y: 0 },
  );
}

function getHandednessLabel(handResults, index) {
  const handedness = handResults.handednesses?.[index] ?? handResults.handedness?.[index];
  return handedness?.[0]?.categoryName ?? handedness?.[0]?.displayName ?? "";
}

function getPrimaryUiHand(handResults) {
  const hands = handResults.landmarks ?? [];
  if (hands.length !== 1) return null;

  const trackedHands = hands
    .map((landmarks, index) => ({
      landmarks,
      handedness: getHandednessLabel(handResults, index).toLowerCase(),
      visualX: 1 - getHandCenter(landmarks).x,
    }))
    .filter((hand) => hand.landmarks[4] && hand.landmarks[8]);
  const rightHand = trackedHands.find((hand) => hand.handedness === "right");
  if (rightHand) return rightHand.landmarks;

  const hasKnownLeftHand = trackedHands.some((hand) => hand.handedness === "left");
  if (hasKnownLeftHand) return null;

  return trackedHands.sort((a, b) => b.visualX - a.visualX)[0]?.landmarks;
}

function hideHandCursor() {
  handCursor.classList.remove("is-visible", "is-pinching");
  setHandCursorTarget(null);
  handCursorPinched = false;
}

function getHandCursorTarget(x, y) {
  const candidates = document.elementsFromPoint(x, y);
  return (
    candidates
      .map((element) => element.closest?.("button, input"))
      .find((element) => element && !element.disabled && element.getClientRects().length > 0) ?? null
  );
}

function setHandCursorTarget(target) {
  if (handCursorTarget === target) return;
  handCursorTarget?.classList.remove("hand-hover");
  handCursorTarget = target;
  handCursorTarget?.classList.add("hand-hover");
}

function activateHandCursorTarget(target) {
  if (!target) return;

  if (target.tagName === "INPUT") {
    target.focus();
    return;
  }

  target.click();
}

function updateHandCursor(handResults) {
  const primaryHand = getPrimaryUiHand(handResults);
  if (!primaryHand) {
    hideHandCursor();
    return;
  }

  const indexTip = primaryHand[8];
  const thumbTip = primaryHand[4];
  const targetX = THREE.MathUtils.clamp((1 - indexTip.x) * window.innerWidth, 0, window.innerWidth);
  const targetY = THREE.MathUtils.clamp(indexTip.y * window.innerHeight, 0, window.innerHeight);
  handCursorX = THREE.MathUtils.lerp(handCursorX, targetX, handCursorGuide.smoothing);
  handCursorY = THREE.MathUtils.lerp(handCursorY, targetY, handCursorGuide.smoothing);

  const thumbIndexDistance = getLandmarkDistance(thumbTip, indexTip);
  const handScale = Math.max(getLandmarkDistance(primaryHand[0], primaryHand[9]), 0.001);
  const thumbIndexRatio = thumbIndexDistance / handScale;
  const isPinching = handCursorPinched
    ? thumbIndexRatio < handCursorGuide.pinchUpRatio
    : thumbIndexRatio < handCursorGuide.pinchDownRatio;
  const target = getHandCursorTarget(handCursorX, handCursorY);

  handCursor.style.left = `${handCursorX}px`;
  handCursor.style.top = `${handCursorY}px`;
  handCursor.classList.add("is-visible");
  handCursor.classList.toggle("is-pinching", isPinching);
  setHandCursorTarget(target);

  if (isPinching && !handCursorPinched) {
    activateHandCursorTarget(target);
  }

  handCursorPinched = isPinching;
}

function getHandClosedScore(landmarks) {
  const fingers = [
    [8, 6],
    [12, 10],
    [16, 14],
    [20, 18],
  ];
  const extended = fingers.reduce((count, [tip, joint]) => count + (landmarks[tip].y < landmarks[joint].y ? 1 : 0), 0);
  return THREE.MathUtils.clamp(1 - extended / fingers.length, 0, 1);
}

function getTrackedHands(hands) {
  return (hands ?? [])
    .map((landmarks) => {
      const center = getHandCenter(landmarks);
      return {
        landmarks,
        center,
        visualX: 1 - center.x,
        closedScore: getHandClosedScore(landmarks),
      };
    })
    .sort((a, b) => a.visualX - b.visualX);
}

function updateThrottleFromHands(hands) {
  const trackedHands = getTrackedHands(hands);

  if (trackedHands.length < 2) {
    playerControl.targetSpeed = 0;
    return {
      available: false,
      message: "show both hands for speed",
      trackedHands,
    };
  }

  const controlHands = [trackedHands[0], trackedHands[trackedHands.length - 1]];
  const closedScore = controlHands.reduce((sum, hand) => sum + hand.closedScore, 0) / controlHands.length;
  const bothClenched = controlHands.every((hand) => hand.closedScore >= handControlGuide.fistThreshold);
  const bothOpen = controlHands.every((hand) => hand.closedScore <= handControlGuide.openThreshold);

  let throttle = 0;
  if (bothClenched) {
    throttle = (closedScore - handControlGuide.fistThreshold) / (1 - handControlGuide.fistThreshold);
  }

  const deadZoneThrottle = Math.abs(throttle) < 0.08 ? 0 : THREE.MathUtils.clamp(throttle, 0, 1);
  const speed = deadZoneThrottle * handControlGuide.maxSpeed;
  const throttleText =
    !bothClenched && !bothOpen
      ? "match hands"
      : deadZoneThrottle === 0
      ? "open slow down"
      : "fist speed up";

  return {
    available: true,
    trackedHands,
    closedScore,
    bothClenched,
    bothOpen,
    throttle: deadZoneThrottle,
    speed,
    throttleText,
  };
}

function updateSteeringFromHands(hands) {
  const trackedHands = getTrackedHands(hands);

  if (trackedHands.length < 2) {
    return {
      available: false,
      message: "show both hands for steering",
      trackedHands,
    };
  }

  const leftHand = trackedHands[0];
  const rightHand = trackedHands[trackedHands.length - 1];
  const handsOnSides = leftHand.visualX < 0.5 && rightHand.visualX >= 0.5;
  const yDelta = rightHand.center.y - leftHand.center.y;
  const steer = Math.abs(yDelta) < handControlGuide.steerDeadZone ? 0 : THREE.MathUtils.clamp(-yDelta / handControlGuide.maxSteerDelta, -1, 1);
  const steeringText = Math.abs(steer) < 0.18 ? "straight" : steer > 0 ? "right" : "left";

  return {
    available: handsOnSides,
    message: handsOnSides ? "" : "hands on both sides",
    trackedHands,
    leftHand,
    rightHand,
    yDelta,
    steer,
    steeringText,
  };
}

function updatePlayerControls(hands) {
  if (raceState.finished) {
    if (raceState.mode === "multiplayer" && raceState.phase === "racing") {
      return updateSpectatorControls(hands);
    }
    playerControl.handActive = false;
    playerControl.targetSpeed = 0;
    playerControl.targetSteer = 0;
    setHandStatus("winner");
    return null;
  }

  if (raceState.phase !== "racing") {
    playerControl.handActive = false;
    playerControl.targetSpeed = 0;
    playerControl.targetSteer = 0;
    setHandStatus(raceState.phase === "countdown" ? "starting" : "waiting for race start");
    return null;
  }

  const throttle = updateThrottleFromHands(hands);
  const steering = updateSteeringFromHands(hands);

  if (!throttle.available) {
    playerControl.handActive = false;
    playerControl.targetSpeed = 0;
    playerControl.targetSteer = 0;
    setHandStatus(throttle.message);
    return { throttle, steering };
  }

  playerControl.handActive = true;
  playerControl.targetSpeed = THREE.MathUtils.lerp(playerControl.targetSpeed, throttle.speed, handControlGuide.targetSpeedSmoothing);

  if (!steering.available) {
    playerControl.targetSteer = 0;
    setHandStatus(steering.message);
    return { throttle, steering };
  }

  playerControl.targetSteer = THREE.MathUtils.lerp(playerControl.targetSteer, steering.steer, handControlGuide.steerInputSmoothing);

  setHandStatus(`driving - ${throttle.throttleText} - ${steering.steeringText}`);
  return { throttle, steering };
}

function getWebcamErrorState(error) {
  if (error?.name === "NotAllowedError" || error?.name === "SecurityError") {
    return "denied";
  }

  if (error?.name === "NotFoundError" || error?.name === "DevicesNotFoundError") {
    return "no-camera";
  }

  if (error?.name === "NotReadableError" || error?.name === "TrackStartError") {
    return "busy";
  }

  if (error?.name === "TypeError" || error?.name === "OverconstrainedError") {
    return "unavailable";
  }

  return "error";
}

function showWebcamOnTrackScreen() {
  if (!webcamScreen || !webcamVideo.srcObject) return;

  webcamTexture?.dispose();
  webcamTexture = new THREE.VideoTexture(webcamVideo);
  webcamTexture.colorSpace = THREE.SRGBColorSpace;
  webcamTexture.minFilter = THREE.LinearFilter;
  webcamTexture.magFilter = THREE.LinearFilter;
  webcamScreen.material = new THREE.MeshBasicMaterial({
    map: webcamTexture,
    side: THREE.FrontSide,
    toneMapped: false,
  });
}

function resetTrackScreen() {
  if (!webcamScreen) return;

  webcamTexture?.dispose();
  webcamTexture = null;
  webcamScreen.material = standbyScreenMaterial;
}

async function ensureHandLandmarker() {
  if (handLandmarker) return handLandmarker;

  visionFileset ??= await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");

  handLandmarker = await HandLandmarker.createFromOptions(visionFileset, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numHands: 2,
    minHandDetectionConfidence: 0.55,
    minHandPresenceConfidence: 0.55,
    minTrackingConfidence: 0.55,
  });

  return handLandmarker;
}

function resizeHandOverlay() {
  const width = webcamVideo.videoWidth || webcamVideo.clientWidth;
  const height = webcamVideo.videoHeight || webcamVideo.clientHeight;
  if (!width || !height) return false;

  if (handOverlay.width !== width || handOverlay.height !== height) {
    handOverlay.width = width;
    handOverlay.height = height;
  }

  return true;
}

function clearHandOverlay() {
  handOverlayContext.clearRect(0, 0, handOverlay.width, handOverlay.height);
}

function drawControlResults(handResults) {
  if (!resizeHandOverlay()) return;

  clearHandOverlay();
  const { width, height } = handOverlay;
  const hands = handResults.landmarks ?? [];
  updateHandCursor(handResults);
  updatePlayerControls(hands);

  handOverlayContext.save();
  handOverlayContext.scale(-1, 1);
  handOverlayContext.translate(-width, 0);
  handOverlayContext.lineCap = "round";
  handOverlayContext.lineJoin = "round";
  handOverlayContext.font = `${Math.max(10, width * 0.032)}px Inter, sans-serif`;

  hands.forEach((landmarks, handIndex) => {
    const handedness = getHandednessLabel(handResults, handIndex) || "Hand";

    handOverlayContext.strokeStyle = "rgba(215, 248, 110, 0.9)";
    handOverlayContext.lineWidth = Math.max(2.2, width * 0.006);
    handConnections.forEach(([start, end]) => {
      const from = landmarks[start];
      const to = landmarks[end];
      handOverlayContext.beginPath();
      handOverlayContext.moveTo(from.x * width, from.y * height);
      handOverlayContext.lineTo(to.x * width, to.y * height);
      handOverlayContext.stroke();
    });

    landmarks.forEach((landmark, index) => {
      const isPinchFinger = index === 4 || index === 8;
      const isWrist = index === 0;
      const radius = isPinchFinger ? Math.max(5, width * 0.018) : isWrist ? Math.max(4, width * 0.014) : Math.max(3, width * 0.01);
      handOverlayContext.fillStyle = isPinchFinger ? "rgba(255, 207, 138, 0.96)" : isWrist ? "rgba(255, 255, 255, 0.96)" : "rgba(59, 183, 255, 0.94)";
      handOverlayContext.strokeStyle = "rgba(5, 8, 8, 0.78)";
      handOverlayContext.lineWidth = Math.max(1.4, width * 0.004);
      handOverlayContext.beginPath();
      handOverlayContext.arc(landmark.x * width, landmark.y * height, radius, 0, Math.PI * 2);
      handOverlayContext.fill();
      handOverlayContext.stroke();
    });

    const wrist = landmarks[0];
    handOverlayContext.scale(-1, 1);
    handOverlayContext.fillStyle = "rgba(215, 248, 110, 0.95)";
    handOverlayContext.textAlign = "center";
    handOverlayContext.fillText(handedness, -(wrist.x * width), Math.max(14, wrist.y * height - 12));
    handOverlayContext.scale(-1, 1);
  });

  handOverlayContext.restore();
}

function runHandTracking() {
  if (!webcamStream || !handLandmarker) return;

  if (webcamVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && webcamVideo.currentTime !== lastHandVideoTime) {
    lastHandVideoTime = webcamVideo.currentTime;
    const timestamp = performance.now();
    const handResults = handLandmarker.detectForVideo(webcamVideo, timestamp);
    drawControlResults(handResults);
  }

  handTrackingFrame = requestAnimationFrame(runHandTracking);
}

function stopHandTracking() {
  if (handTrackingFrame) {
    cancelAnimationFrame(handTrackingFrame);
    handTrackingFrame = null;
  }
  lastHandVideoTime = -1;
  clearHandOverlay();
  playerControl.handActive = false;
  playerControl.speed = 0;
  playerControl.targetSpeed = 0;
  setHandStatus("off");
  hideHandCursor();
}

async function startWebcam() {
  if (!navigator.mediaDevices?.getUserMedia) {
    setWebcamState("unavailable");
    return;
  }
  if (webcamStream || isWebcamStarting) return;

  isWebcamStarting = true;
  setWebcamState("loading", "Waiting for camera permission...");
  setHandStatus("waiting");

  try {
    webcamStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: "user",
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    });

    webcamVideo.srcObject = webcamStream;
    await webcamVideo.play();
    showWebcamOnTrackScreen();
    setWebcamState("loading", "Loading hand tracker...");
    setHandStatus("loading model");

    try {
      await ensureHandLandmarker();
      setHandStatus("0 detected");
      runHandTracking();
    } catch (error) {
      console.warn("Hand tracking failed:", error);
      setHandStatus("tracker unavailable");
    }

    setWebcamState("live");
  } catch (error) {
    console.warn("Webcam access failed:", error);
    stopWebcam({ preserveState: true });
    setWebcamState(getWebcamErrorState(error));
  } finally {
    isWebcamStarting = false;
  }
}

function stopWebcam(options = {}) {
  webcamStream?.getTracks().forEach((track) => track.stop());
  webcamStream = null;
  webcamVideo.srcObject = null;
  resetTrackScreen();
  stopHandTracking();
  if (!options.preserveState) {
    setWebcamState("idle");
  }
}

webcamStartButton?.addEventListener("click", startWebcam);
webcamStopButton?.addEventListener("click", stopWebcam);
window.addEventListener("beforeunload", () => {
  leaveLobbyIfNeeded();
  stopWebcam();
});
setWebcamState("idle");
if (raceState.phase === "menu") {
  void startWebcam();
}

let cameraMode = "map";
function setCameraMode(mode) {
  cameraMode = mode;
  document.querySelectorAll("[data-camera]").forEach((item) => {
    const isActive = item.dataset.camera === mode;
    item.classList.toggle("active", isActive);
    item.setAttribute("aria-pressed", String(isActive));
  });
  controls.enabled = cameraMode === "map" && raceState.phase === "menu";
}

document.querySelectorAll("[data-camera]").forEach((button) => {
  button.addEventListener("click", () => {
    if (raceState.phase !== "menu") return;
    setCameraMode(button.dataset.camera);
  });
});
raceModeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.menuMode === "multiplayer") {
      showMultiplayerConfig();
      return;
    }
    beginCountdown(button.dataset.menuMode);
  });
});
multiplayerConfigForm.addEventListener("submit", (event) => {
  event.preventDefault();
});
createRoomButton.addEventListener("click", createMultiplayerRoom);
showJoinRoomButton.addEventListener("click", showJoinRoom);
joinRoomButton.addEventListener("click", joinMultiplayerRoom);
refreshLobbiesButton.addEventListener("click", () => {
  selectedLobbyCode = "";
  renderAvailableLobbies();
  sendMultiplayerMessage({ type: "sync" });
});
roomCodeInput.addEventListener("input", () => {
  roomCodeInput.value = roomCodeInput.value.toUpperCase();
  selectedLobbyCode = "";
  multiplayerMessage.classList.remove("is-visible");
  renderAvailableLobbies();
});
readyToggleButton.addEventListener("click", toggleReady);
startMultiplayerButton.addEventListener("click", startConfiguredMultiplayer);
multiplayerBackButton.addEventListener("click", handleMultiplayerBack);
resultsMainMenuButton.addEventListener("click", showMainMenu);
resultsReturnButton.addEventListener("click", returnToMultiplayerLobby);
helpOpenButton.addEventListener("click", showHelpModal);
helpCloseButton.addEventListener("click", hideHelpModal);
pauseOpenButton.addEventListener("click", showPauseMenu);
pauseResumeButton.addEventListener("click", resumePausedRace);
pauseExitButton.addEventListener("click", exitPausedRace);
document.querySelectorAll("[data-room-key]").forEach((button) => {
  button.addEventListener("click", () => pressRoomCodeKey(button.dataset.roomKey));
});
window.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (raceState.phase === "paused") {
    resumePausedRace();
    return;
  }
  showPauseMenu();
});
multiplayerRoomChannel?.addEventListener("message", syncCurrentRoom);
window.addEventListener("storage", (event) => {
  if (event.key === multiplayerStorageKey) {
    try {
      multiplayerRoomsCache = JSON.parse(event.newValue) ?? {};
    } catch {
      multiplayerRoomsCache = {};
    }
    syncCurrentRoom();
  }
});
renderer.domElement.addEventListener("pointermove", updateHoveredCar);
renderer.domElement.addEventListener("pointerleave", () => setHoveredCar(null));

function updateCamera(t) {
  const spectatedCar =
    raceState.mode === "multiplayer" && raceState.finished && raceState.spectatingPlayerId
      ? remotePlayerCars.get(raceState.spectatingPlayerId)
      : null;
  const targetCar = spectatedCar?.visible ? spectatedCar : playerCar;
  const carPosition = targetCar.position.clone();
  const targetHeading =
    spectatedCar?.visible
      ? targetCar.rotation.y - carModelRotationOffset
      : playerControl.visualHeading;
  const heading = new THREE.Vector3(Math.sin(targetHeading), 0, Math.cos(targetHeading)).normalize();
  const behind = carPosition.clone().addScaledVector(heading, -22);

  if (cameraMode === "chase") {
    camera.position.lerp(new THREE.Vector3(behind.x, 13, behind.z).add(new THREE.Vector3(0, 0, 0)), 0.075);
    controls.target.lerp(carPosition.clone().add(new THREE.Vector3(0, 2.3, 0)), 0.12);
  } else if (cameraMode === "cinematic") {
    const orbit = new THREE.Vector3(Math.sin(t * Math.PI * 2) * 86, 48, Math.cos(t * Math.PI * 2) * 86);
    camera.position.lerp(orbit, 0.018);
    controls.target.lerp(new THREE.Vector3(0, 0, 0), 0.025);
  } else {
    camera.position.lerp(new THREE.Vector3(0, 265, 0.1), 0.08);
    controls.target.lerp(new THREE.Vector3(0, 0, 0), 0.08);
  }
}

function animate() {
  const delta = Math.min(clock.getDelta(), 0.05);
  const raceNow = getRaceClockTime();

  if (raceState.phase === "countdown") {
    raceState.countdownRemaining = Math.max(0, raceState.countdownDuration - (raceNow - raceState.countdownStartTime));
    if (raceState.countdownRemaining <= 0) {
      startRace(raceNow);
    } else {
      updateGameUi();
    }
  }

  if (raceState.started && !raceState.finished && raceState.phase !== "paused") {
    raceState.elapsed = raceNow - raceState.startTime;
  }

  if (raceState.phase === "racing" && (playerControl.handActive || Math.abs(playerControl.speed) > 0.05)) {
    playerControl.speed = THREE.MathUtils.lerp(playerControl.speed, playerControl.targetSpeed, handControlGuide.speedSmoothing);
    playerControl.steer = THREE.MathUtils.lerp(playerControl.steer, playerControl.targetSteer, handControlGuide.steerSmoothing);
    playerControl.heading += playerControl.steer * delta * handControlGuide.turnRate;
    playerControl.position.x += Math.sin(playerControl.heading) * playerControl.speed * delta;
    playerControl.position.z += Math.cos(playerControl.heading) * playerControl.speed * delta;
    keepPlayerOnTrack();
    smoothVisualPlayerPose(delta);
    placePlayerCar();
    updateLocalMultiplayerCarState();
    updateCheckpointProgress(delta);
  } else if (raceState.phase === "racing" && raceState.mode === "multiplayer") {
    smoothVisualPlayerPose(delta);
    placePlayerCar();
    updateLocalMultiplayerCarState();
  } else {
    smoothVisualPlayerPose(delta);
    placePlayerCar();
  }

  updateWrongWayRespawn(delta);
  updateOpponentVisibility();
  smoothRemotePlayerCars(delta);
  if (raceState.phase === "racing" && raceState.mode !== "multiplayer") {
    updateSingleplayerAiCars(delta);
  } else if (["menu", "countdown", "multiplayer-config", "finished"].includes(raceState.phase)) {
    placeStartingGrid();
  }

  updateCamera(playerControl.progress);
  updateRaceHud();
  updateConfettiBursts(delta);
  controls.update();
  updateCarHoverLabel();
  updateCarNameLabels();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

window.addEventListener("resize", () => {
  updateAppViewportSize();
  const { width, height } = getAppViewportSize();
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  updateCarHoverLabel();
  updateCarNameLabels();
});
window.visualViewport?.addEventListener("resize", updateAppViewportSize);
window.addEventListener("orientationchange", () => {
  window.setTimeout(() => {
    updateAppViewportSize();
    const { width, height } = getAppViewportSize();
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    updateCarHoverLabel();
    updateCarNameLabels();
  }, 150);
});

setCameraMode("map");
updateAppViewportSize();
animate();
