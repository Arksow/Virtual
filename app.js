import { DrawingUtils, FilesetResolver, HandLandmarker } from "/node_modules/@mediapipe/tasks-vision/vision_bundle.mjs";

(() => {
  "use strict";

  const canvas = document.querySelector("#gameCanvas");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.querySelector("#score");
  const timerEl = document.querySelector("#timer");
  const bestEl = document.querySelector("#best");
  const debugPanel = document.querySelector("#debugPanel");
  const video = document.querySelector("#webcam");
  const handCanvas = document.querySelector("#handCanvas");
  const handCtx = handCanvas.getContext("2d");
  const cameraPanel = document.querySelector(".camera-panel");
  const cameraButton = document.querySelector("#cameraButton");
  const cameraStatusEl = document.querySelector("#cameraStatus");
  const cameraHelpEl = document.querySelector("#cameraHelp");
  const pauseButton = document.querySelector("#pauseButton");
  const restartButton = document.querySelector("#restartButton");
  const startPanel = document.querySelector("#startPanel");
  const panelKicker = document.querySelector("#panelKicker");
  const panelTitle = document.querySelector("#panelTitle");
  const panelText = document.querySelector("#panelText");
  const startButton = document.querySelector("#startButton");
  const panelRestartButton = document.querySelector("#panelRestartButton");

  const roundLength = 30;
  const playInset = 18;
  const collectibleCount = 4;
  const hazardCount = 3;
  const reticleRadius = 18;
  const reticleSpeed = 360;
  const handSmoothingMin = 0.28;
  const handSmoothingMax = 0.72;
  const handLandmarkerModel =
    "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
  const moveKeys = new Set([
    "ArrowLeft",
    "ArrowRight",
    "ArrowUp",
    "ArrowDown",
    "KeyA",
    "KeyD",
    "KeyW",
    "KeyS",
  ]);
  const colors = {
    ink: "#18222d",
    grid: "rgba(255, 255, 255, 0.12)",
    gridStrong: "rgba(255, 255, 255, 0.2)",
    teal: "#19b7a4",
    gold: "#f8bc40",
    coral: "#f2645a",
    violet: "#6653d9",
    blue: "#4f9ce8",
    white: "#ffffff",
  };

  const state = {
    width: 900,
    height: 560,
    dpr: 1,
    phase: "ready",
    running: false,
    score: 0,
    best: Number(localStorage.getItem("handArcadeBest") || 0),
    timeLeft: roundLength,
    lastFrame: 0,
    activeKeys: new Set(),
    reticle: {
      x: 450,
      y: 280,
      visible: true,
    },
    debug: {
      fps: 0,
      cameraStatus: "Camera idle",
      lastCollision: "none",
      nearestKind: "none",
      nearestDistance: 0,
      handStatus: "hands idle",
    },
    hand: {
      count: 0,
      lastSeenAt: 0,
      point: null,
      mapped: null,
      smoothed: null,
    },
    bursts: [],
    floaters: [],
    feedback: {
      flash: 0,
      flashColor: colors.white,
      shake: 0,
    },
    collectibles: [],
    hazards: [],
  };

  let cameraStream = null;
  let handLandmarker = null;
  let handDrawingUtils = null;
  let handFrameId = null;
  let lastVideoTime = -1;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function resize() {
    const bounds = canvas.getBoundingClientRect();
    state.width = Math.max(320, bounds.width);
    state.height = Math.max(300, bounds.height);
    state.dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    canvas.width = Math.round(state.width * state.dpr);
    canvas.height = Math.round(state.height * state.dpr);
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    keepObjectsInBounds();
    keepReticleInBounds();
    draw();
  }

  function keepReticleInBounds() {
    const min = playInset + reticleRadius;
    state.reticle.x = clamp(state.reticle.x, min, state.width - min);
    state.reticle.y = clamp(state.reticle.y, min, state.height - min);
  }

  function keepObjectsInBounds() {
    for (const object of [...state.collectibles, ...state.hazards]) {
      clampObjectToPlayArea(object);
    }
  }

  function startGame() {
    resetRound();
    setGamePhase("running");
  }

  function resetRound() {
    state.score = 0;
    state.timeLeft = roundLength;
    state.bursts = [];
    state.floaters = [];
    state.feedback.flash = 0;
    state.feedback.shake = 0;
    state.reticle.x = state.width * 0.5;
    state.reticle.y = state.height * 0.5;
    state.reticle.visible = true;
    state.debug.lastCollision = "none";
    resetObjects();
    state.lastFrame = performance.now();
    updateHud();
  }

  function pauseGame() {
    if (state.phase !== "running") return;

    state.activeKeys.clear();
    setGamePhase("paused");
  }

  function resumeGame() {
    if (state.phase !== "paused") return;

    state.lastFrame = performance.now();
    setGamePhase("running");
  }

  function restartGame() {
    resetRound();
    setGamePhase("running");
  }

  function togglePause() {
    if (state.phase === "running") {
      pauseGame();
      return;
    }

    if (state.phase === "paused") {
      resumeGame();
    }
  }

  function handlePrimaryAction() {
    if (state.phase === "paused") {
      resumeGame();
      return;
    }

    startGame();
  }

  function endGame() {
    state.activeKeys.clear();
    state.best = Math.max(state.best, state.score);
    localStorage.setItem("handArcadeBest", String(state.best));
    updateHud();
    setGamePhase("gameover");
  }

  function setGamePhase(phase) {
    state.phase = phase;
    state.running = phase === "running";
    syncGameUi();
  }

  function syncGameUi() {
    pauseButton.hidden = !["running", "paused"].includes(state.phase);
    restartButton.hidden = !["running", "paused"].includes(state.phase);
    pauseButton.textContent = state.phase === "paused" ? "Resume" : "Pause";

    startPanel.hidden = state.phase === "running";
    panelRestartButton.hidden = state.phase !== "paused";

    if (state.phase === "ready") {
      panelKicker.textContent = "Ready";
      panelTitle.textContent = "Beat the clock";
      panelText.textContent = "Collect glowing orbs, avoid red hazards, and beat the clock.";
      startButton.textContent = "Start Game";
    }

    if (state.phase === "paused") {
      panelKicker.textContent = "Paused";
      panelTitle.textContent = "Take a breath";
      panelText.textContent = "Resume to keep collecting, or restart the round.";
      startButton.textContent = "Resume";
    }

    if (state.phase === "gameover") {
      panelKicker.textContent = "Game Over";
      panelTitle.textContent = "Time";
      panelText.textContent = `You scored ${state.score}. Collect orbs and dodge hazards next round.`;
      startButton.textContent = "Restart";
    }
  }

  function updateHud() {
    scoreEl.textContent = String(state.score);
    timerEl.textContent = String(Math.ceil(state.timeLeft));
    bestEl.textContent = String(state.best);
  }

  async function toggleCamera() {
    if (cameraStream) {
      stopCamera();
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState({
        state: "error",
        status: "Camera unsupported",
        help: "This browser cannot open a webcam here.",
        buttonText: "Unavailable",
        disabled: true,
      });
      return;
    }

    setCameraState({
      state: "loading",
      status: "Starting camera",
      help: "Allow access in the browser prompt.",
      buttonText: "Loading...",
      disabled: true,
    });

    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          width: { ideal: 640 },
          height: { ideal: 360 },
          facingMode: "user",
        },
      });
      video.srcObject = cameraStream;
      await video.play();
      setCameraState({
        state: "loading",
        status: "Loading hand model",
        help: "Preparing MediaPipe landmarks.",
        buttonText: "Loading...",
        disabled: true,
      });
      await ensureHandLandmarker();
      startHandTracking();
      setCameraState({
        state: "live",
        status: "Camera live",
        help: "Hand tracking is active.",
        buttonText: "Stop",
      });
    } catch (error) {
      const hadCameraStream = Boolean(cameraStream);
      for (const track of cameraStream?.getTracks() || []) {
        track.stop();
      }
      cameraStream = null;
      video.srcObject = null;
      setCameraState(hadCameraStream ? handModelErrorState() : cameraErrorState(error));
      console.warn("[camera]", error);
    }
  }

  function stopCamera() {
    stopHandTracking();
    for (const track of cameraStream?.getTracks() || []) {
      track.stop();
    }
    cameraStream = null;
    video.srcObject = null;
    handCtx.clearRect(0, 0, handCanvas.width, handCanvas.height);
    state.hand.count = 0;
    state.hand.point = null;
    state.hand.mapped = null;
    state.hand.smoothed = null;
    state.debug.handStatus = "hands idle";
    setCameraState({
      state: "idle",
      status: "Camera idle",
      help: "Start the camera when ready.",
      buttonText: "Start Camera",
    });
  }

  function setCameraState({ state: cameraState, status, help, buttonText, disabled = false }) {
    cameraPanel.dataset.state = cameraState;
    cameraStatusEl.textContent = status;
    cameraHelpEl.textContent = help;
    cameraButton.textContent = buttonText;
    cameraButton.disabled = disabled;
    state.debug.cameraStatus = status;
  }

  function cameraErrorState(error) {
    if (error?.name === "NotAllowedError" || error?.name === "PermissionDeniedError") {
      return {
        state: "error",
        status: "Permission denied",
        help: "Allow camera access, then try again.",
        buttonText: "Try Again",
      };
    }

    if (error?.name === "NotFoundError" || error?.name === "DevicesNotFoundError") {
      return {
        state: "error",
        status: "No camera found",
        help: "Connect a camera and try again.",
        buttonText: "Try Again",
      };
    }

    if (error?.name === "NotReadableError" || error?.name === "TrackStartError") {
      return {
        state: "error",
        status: "Camera busy",
        help: "Close other apps using the camera.",
        buttonText: "Try Again",
      };
    }

    if (error?.name === "SecurityError") {
      return {
        state: "error",
        status: "Camera blocked",
        help: "Use localhost or allow browser access.",
        buttonText: "Try Again",
      };
    }

    return {
      state: "error",
      status: "Camera unavailable",
      help: "Check the camera and try again.",
      buttonText: "Try Again",
    };
  }

  function handModelErrorState() {
    return {
      state: "error",
      status: "Hand model failed",
      help: "Check network access and try again.",
      buttonText: "Try Again",
    };
  }

  async function ensureHandLandmarker() {
    if (handLandmarker) return;

    const vision = await FilesetResolver.forVisionTasks("/node_modules/@mediapipe/tasks-vision/wasm");
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: handLandmarkerModel,
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numHands: 2,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    handDrawingUtils = new DrawingUtils(handCtx);
  }

  function startHandTracking() {
    stopHandTracking();
    lastVideoTime = -1;
    handFrameId = requestAnimationFrame(predictHands);
  }

  function stopHandTracking() {
    if (handFrameId) {
      cancelAnimationFrame(handFrameId);
      handFrameId = null;
    }
  }

  function predictHands(now) {
    if (!cameraStream || !handLandmarker || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      handFrameId = requestAnimationFrame(predictHands);
      return;
    }

    syncHandCanvasSize();

    if (video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      const results = handLandmarker.detectForVideo(video, now);
      updateHandState(results);
      drawHandLandmarks(results);
    }

    handFrameId = requestAnimationFrame(predictHands);
  }

  function syncHandCanvasSize() {
    const width = video.videoWidth || 640;
    const height = video.videoHeight || 360;
    if (handCanvas.width !== width || handCanvas.height !== height) {
      handCanvas.width = width;
      handCanvas.height = height;
    }
  }

  function updateHandState(results) {
    const hands = results.landmarks || [];
    state.hand.count = hands.length;

    if (!hands.length) {
      state.hand.point = null;
      state.hand.mapped = null;
      state.hand.smoothed = null;
      state.debug.handStatus = "no hands";
      return;
    }

    const indexTip = hands[0][8];
    const reticlePoint = mapIndexFingertipToReticle(indexTip);
    const smoothedPoint = smoothHandReticlePoint(reticlePoint);
    state.hand.point = indexTip;
    state.hand.mapped = reticlePoint;
    state.hand.smoothed = smoothedPoint;
    state.hand.lastSeenAt = performance.now();
    state.debug.handStatus = `${hands.length} hand${hands.length === 1 ? "" : "s"}`;

    state.reticle.x = smoothedPoint.x;
    state.reticle.y = smoothedPoint.y;
    state.reticle.visible = true;
  }

  function mapIndexFingertipToReticle(indexTip) {
    const min = playInset + reticleRadius;
    return {
      x: clamp((1 - indexTip.x) * state.width, min, state.width - min),
      y: clamp(indexTip.y * state.height, min, state.height - min),
    };
  }

  function smoothHandReticlePoint(point) {
    if (!state.hand.smoothed) return point;

    const dx = point.x - state.hand.smoothed.x;
    const dy = point.y - state.hand.smoothed.y;
    const distance = Math.hypot(dx, dy);
    const responsiveness = clamp(distance / 140, 0, 1);
    const alpha = handSmoothingMin + (handSmoothingMax - handSmoothingMin) * responsiveness;

    return {
      x: state.hand.smoothed.x + dx * alpha,
      y: state.hand.smoothed.y + dy * alpha,
    };
  }

  function drawHandLandmarks(results) {
    handCtx.save();
    handCtx.clearRect(0, 0, handCanvas.width, handCanvas.height);

    for (const landmarks of results.landmarks || []) {
      handDrawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, {
        color: "rgba(25, 183, 164, 0.88)",
        lineWidth: 3,
      });
      handDrawingUtils.drawLandmarks(landmarks, {
        color: "#f8bc40",
        fillColor: "#f8bc40",
        radius: 3,
      });
    }

    handCtx.restore();
  }

  function randomDirection() {
    return Math.random() > 0.5 ? 1 : -1;
  }

  function resetObjects() {
    state.collectibles = Array.from({ length: collectibleCount }, () => createObject("collectible"));
    state.hazards = Array.from({ length: hazardCount }, () => createObject("hazard"));
  }

  function createObject(kind, position = null) {
    const isHazard = kind === "hazard";
    const radius = isHazard ? 20 + Math.random() * 7 : 24 + Math.random() * 9;
    const speed = isHazard ? 115 + Math.random() * 75 : 75 + Math.random() * 65;
    const point = position || randomPlayPoint(radius);

    return {
      kind,
      x: point.x,
      y: point.y,
      radius,
      vx: randomDirection() * speed,
      vy: randomDirection() * speed * (0.72 + Math.random() * 0.42),
      pulse: Math.random() * Math.PI * 2,
      cooldown: 0,
      color: isHazard ? colors.coral : [colors.teal, colors.gold, colors.blue][Math.floor(Math.random() * 3)],
    };
  }

  function randomPlayPoint(radius) {
    const min = playInset + radius;
    const safeDistance = radius + reticleRadius + 72;

    for (let attempt = 0; attempt < 24; attempt += 1) {
      const point = {
        x: min + Math.random() * Math.max(1, state.width - min * 2),
        y: min + Math.random() * Math.max(1, state.height - min * 2),
      };
      const dx = point.x - state.reticle.x;
      const dy = point.y - state.reticle.y;
      if (Math.hypot(dx, dy) > safeDistance) return point;
    }

    return {
      x: clamp(state.reticle.x + safeDistance, min, state.width - min),
      y: clamp(state.reticle.y + safeDistance, min, state.height - min),
    };
  }

  function clampObjectToPlayArea(object) {
    const min = playInset + object.radius;
    object.x = clamp(object.x, min, state.width - min);
    object.y = clamp(object.y, min, state.height - min);
  }

  function update(dt) {
    if (state.phase !== "running") return;

    updateReticle(dt);
    state.timeLeft -= dt;
    updateObjects(state.collectibles, dt);
    updateObjects(state.hazards, dt);
    checkObjectCollisions();
    updateFeedback(dt);

    state.bursts = state.bursts
      .map((burst) => ({ ...burst, life: burst.life - dt }))
      .filter((burst) => burst.life > 0);

    updateHud();
    if (state.timeLeft <= 0) {
      state.timeLeft = 0;
      endGame();
    }
  }

  function updateObjects(objects, dt) {
    for (const object of objects) {
      const min = playInset + object.radius;
      const maxX = state.width - min;
      const maxY = state.height - min;

      object.pulse += dt * (object.kind === "hazard" ? 8 : 5);
      object.cooldown = Math.max(0, object.cooldown - dt);
      object.x += object.vx * dt;
      object.y += object.vy * dt;

      if (object.x <= min || object.x >= maxX) {
        object.vx *= -1;
        object.x = clamp(object.x, min, maxX);
      }

      if (object.y <= min || object.y >= maxY) {
        object.vy *= -1;
        object.y = clamp(object.y, min, maxY);
      }
    }
  }

  function checkObjectCollisions() {
    if (state.phase !== "running") return;

    for (let index = 0; index < state.collectibles.length; index += 1) {
      const collectible = state.collectibles[index];
      if (!reticleOverlaps(collectible)) continue;

      state.score += 1;
      state.timeLeft = Math.min(roundLength, state.timeLeft + 0.6);
      state.debug.lastCollision = `collectible +1 @ ${formatPoint(collectible)}`;
      console.info("[collision]", state.debug.lastCollision);
      addBurst(collectible, colors.gold, 1);
      addFloatingText(collectible, "+1", colors.gold);
      setReticleFlash(colors.gold);
      state.collectibles[index] = createObject("collectible");
    }

    for (let index = 0; index < state.hazards.length; index += 1) {
      const hazard = state.hazards[index];
      if (hazard.cooldown > 0 || !reticleOverlaps(hazard)) continue;

      state.score = Math.max(0, state.score - 2);
      state.timeLeft = Math.max(0, state.timeLeft - 1.5);
      state.debug.lastCollision = `hazard -2 @ ${formatPoint(hazard)}`;
      console.info("[collision]", state.debug.lastCollision);
      addBurst(hazard, colors.coral, 1.25);
      addFloatingText(hazard, "-2", colors.coral);
      setReticleFlash(colors.coral);
      state.feedback.shake = 0.22;
      state.hazards[index] = createObject("hazard");
    }
  }

  function updateDebugState() {
    const nearest = [...state.collectibles, ...state.hazards].reduce(
      (closest, object) => {
        const dx = state.reticle.x - object.x;
        const dy = state.reticle.y - object.y;
        const edgeDistance = Math.hypot(dx, dy) - (reticleRadius + object.radius);
        return edgeDistance < closest.distance ? { kind: object.kind, distance: edgeDistance } : closest;
      },
      { kind: "none", distance: Infinity },
    );

    state.debug.nearestKind = nearest.kind;
    state.debug.nearestDistance = Number.isFinite(nearest.distance) ? nearest.distance : 0;
  }

  function reticleOverlaps(object) {
    return circlesOverlap(
      { x: state.reticle.x, y: state.reticle.y, radius: reticleRadius },
      object,
    );
  }

  function circlesOverlap(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const radiusSum = a.radius + b.radius;
    return dx * dx + dy * dy <= radiusSum * radiusSum;
  }

  function addBurst(object, color, scale = 1) {
    state.bursts.push({
      x: object.x,
      y: object.y,
      radius: object.radius * scale,
      life: 0.45,
      color,
    });
  }

  function addFloatingText(object, text, color) {
    state.floaters.push({
      x: object.x,
      y: object.y - object.radius,
      text,
      color,
      life: 0.8,
      vy: -42,
    });
  }

  function setReticleFlash(color) {
    state.feedback.flash = 0.25;
    state.feedback.flashColor = color;
  }

  function updateFeedback(dt) {
    state.feedback.flash = Math.max(0, state.feedback.flash - dt);
    state.feedback.shake = Math.max(0, state.feedback.shake - dt);
    state.floaters = state.floaters
      .map((floater) => ({
        ...floater,
        y: floater.y + floater.vy * dt,
        life: floater.life - dt,
      }))
      .filter((floater) => floater.life > 0);
  }

  function formatPoint(object) {
    return `${Math.round(object.x)},${Math.round(object.y)}`;
  }

  function updateReticle(dt) {
    let dx = 0;
    let dy = 0;

    if (state.activeKeys.has("ArrowLeft") || state.activeKeys.has("KeyA")) dx -= 1;
    if (state.activeKeys.has("ArrowRight") || state.activeKeys.has("KeyD")) dx += 1;
    if (state.activeKeys.has("ArrowUp") || state.activeKeys.has("KeyW")) dy -= 1;
    if (state.activeKeys.has("ArrowDown") || state.activeKeys.has("KeyS")) dy += 1;

    if (dx === 0 && dy === 0) return;

    moveReticle(dx, dy, reticleSpeed * dt);
  }

  function nudgeReticle(code) {
    const direction = {
      ArrowLeft: [-1, 0],
      KeyA: [-1, 0],
      ArrowRight: [1, 0],
      KeyD: [1, 0],
      ArrowUp: [0, -1],
      KeyW: [0, -1],
      ArrowDown: [0, 1],
      KeyS: [0, 1],
    }[code];

    if (!direction) return;
    moveReticle(direction[0], direction[1], 28);
  }

  function moveReticle(dx, dy, distance) {
    const length = Math.hypot(dx, dy);
    if (length === 0) return;

    state.reticle.x += (dx / length) * distance;
    state.reticle.y += (dy / length) * distance;
    state.reticle.visible = true;
    keepReticleInBounds();
  }

  function isActivationKey(event) {
    return event.code === "Space" || event.code === "Enter" || event.key === " " || event.key === "Spacebar" || event.key === "Enter";
  }

  function draw() {
    updateDebugState();
    const shake = currentShake();
    ctx.save();
    ctx.translate(shake.x, shake.y);
    drawBackground();
    drawBursts();
    drawObjects();
    drawFloaters();
    drawPointer();
    ctx.restore();
    drawDebugOverlay();
  }

  function currentShake() {
    if (state.feedback.shake <= 0) return { x: 0, y: 0 };

    const strength = 7 * (state.feedback.shake / 0.22);
    return {
      x: (Math.random() - 0.5) * strength,
      y: (Math.random() - 0.5) * strength,
    };
  }

  function drawDebugOverlay() {
    debugPanel.innerHTML = [
      `fps: ${Math.round(state.debug.fps)}`,
      `state: ${state.phase}`,
      `camera: ${state.debug.cameraStatus}`,
      `hand: ${state.debug.handStatus}`,
      `reticle: ${Math.round(state.reticle.x)}, ${Math.round(state.reticle.y)} r=${reticleRadius}`,
      `index tip: ${formatLandmarkDebug()}`,
      `objects: ${state.collectibles.length} collectibles / ${state.hazards.length} hazards`,
      `nearest: ${state.debug.nearestKind} ${state.debug.nearestDistance.toFixed(1)}px`,
      `last: ${state.debug.lastCollision}`,
    ]
      .map((line) => `<span>${line}</span>`)
      .join("");
  }

  function formatLandmarkDebug() {
    if (!state.hand.point || !state.hand.mapped) return "none";

    return `${state.hand.point.x.toFixed(2)}, ${state.hand.point.y.toFixed(2)} -> ${Math.round(state.hand.mapped.x)}, ${Math.round(state.hand.mapped.y)} / smooth ${Math.round(state.reticle.x)}, ${Math.round(state.reticle.y)}`;
  }

  function drawBackground() {
    const gradient = ctx.createLinearGradient(0, 0, state.width, state.height);
    gradient.addColorStop(0, "#152536");
    gradient.addColorStop(0.48, "#213b45");
    gradient.addColorStop(1, "#1a2634");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, state.width, state.height);

    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    for (let x = 0; x < state.width; x += 42) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, state.height);
      ctx.stroke();
    }
    for (let y = 0; y < state.height; y += 42) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(state.width, y);
      ctx.stroke();
    }

    ctx.strokeStyle = colors.gridStrong;
    ctx.lineWidth = 2;
    ctx.strokeRect(playInset, playInset, state.width - playInset * 2, state.height - playInset * 2);
  }

  function drawObjects() {
    for (const collectible of state.collectibles) {
      drawCollectible(collectible);
    }

    for (const hazard of state.hazards) {
      drawHazard(hazard);
    }
  }

  function drawCollectible(object) {
    const pulse = Math.sin(object.pulse) * 3;

    ctx.save();
    ctx.translate(object.x, object.y);

    ctx.globalAlpha = 0.28;
    ctx.fillStyle = object.color;
    ctx.beginPath();
    ctx.arc(0, 0, object.radius + 16 + pulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 1;
    ctx.fillStyle = object.color;
    ctx.beginPath();
    ctx.arc(0, 0, object.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineWidth = 4;
    ctx.strokeStyle = colors.white;
    ctx.beginPath();
    ctx.arc(0, 0, object.radius - 7, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = colors.ink;
    ctx.beginPath();
    ctx.arc(0, 0, object.radius * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawHazard(object) {
    const pulse = Math.sin(object.pulse) * 2;

    ctx.save();
    ctx.translate(object.x, object.y);
    ctx.rotate(Math.PI / 4);

    ctx.globalAlpha = 0.24;
    ctx.fillStyle = colors.coral;
    ctx.fillRect(-object.radius - 12 - pulse, -object.radius - 12 - pulse, (object.radius + 12 + pulse) * 2, (object.radius + 12 + pulse) * 2);

    ctx.globalAlpha = 1;
    ctx.fillStyle = colors.coral;
    ctx.fillRect(-object.radius, -object.radius, object.radius * 2, object.radius * 2);

    ctx.strokeStyle = colors.white;
    ctx.lineWidth = 4;
    ctx.strokeRect(-object.radius + 6, -object.radius + 6, object.radius * 2 - 12, object.radius * 2 - 12);
    ctx.restore();
  }

  function drawHandIcon(x, y, scale) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale / 38, scale / 38);
    ctx.beginPath();
    ctx.roundRect(-10, -5, 20, 27, 8);
    ctx.roundRect(-15, -24, 8, 28, 4);
    ctx.roundRect(-5, -30, 8, 30, 4);
    ctx.roundRect(5, -27, 8, 28, 4);
    ctx.roundRect(15, -18, 8, 24, 4);
    ctx.fill();
    ctx.restore();
  }

  function drawBursts() {
    for (const burst of state.bursts) {
      const progress = 1 - burst.life / 0.45;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - progress);
      ctx.strokeStyle = burst.color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(burst.x, burst.y, burst.radius + progress * 44, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawFloaters() {
    for (const floater of state.floaters) {
      const alpha = clamp(floater.life / 0.8, 0, 1);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = "900 24px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.lineWidth = 5;
      ctx.strokeStyle = "rgba(15, 24, 34, 0.75)";
      ctx.fillStyle = floater.color;
      ctx.strokeText(floater.text, floater.x, floater.y);
      ctx.fillText(floater.text, floater.x, floater.y);
      ctx.restore();
    }
  }

  function drawPointer() {
    if (!state.reticle.visible) return;

    ctx.save();
    ctx.translate(state.reticle.x, state.reticle.y);
    ctx.strokeStyle = state.feedback.flash > 0 ? state.feedback.flashColor : colors.white;
    ctx.lineWidth = 2;
    if (state.feedback.flash > 0) {
      ctx.globalAlpha = 0.32;
      ctx.fillStyle = state.feedback.flashColor;
      ctx.beginPath();
      ctx.arc(0, 0, reticleRadius + 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-reticleRadius, 0);
    ctx.lineTo(reticleRadius, 0);
    ctx.moveTo(0, -reticleRadius);
    ctx.lineTo(0, reticleRadius);
    ctx.stroke();
    ctx.restore();
  }

  function canvasPoint(event) {
    const bounds = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - bounds.left) / bounds.width) * state.width,
      y: ((event.clientY - bounds.top) / bounds.height) * state.height,
    };
  }

  function loop(now) {
    const elapsed = (now - state.lastFrame) / 1000 || 0;
    updateFps(elapsed);
    const dt = Math.min(0.04, elapsed);
    state.lastFrame = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  function updateFps(elapsed) {
    if (elapsed <= 0 || elapsed > 1) return;

    const instantFps = 1 / elapsed;
    state.debug.fps = state.debug.fps ? state.debug.fps * 0.9 + instantFps * 0.1 : instantFps;
  }

  function bindEvents() {
    startButton.addEventListener("click", handlePrimaryAction);
    panelRestartButton.addEventListener("click", restartGame);
    pauseButton.addEventListener("click", togglePause);
    restartButton.addEventListener("click", restartGame);
    cameraButton.addEventListener("click", toggleCamera);

    canvas.addEventListener("pointermove", (event) => {
      const point = canvasPoint(event);
      state.reticle.x = point.x;
      state.reticle.y = point.y;
      state.reticle.visible = true;
      keepReticleInBounds();
    });

    canvas.addEventListener("pointerleave", () => {
      state.reticle.visible = state.activeKeys.size > 0;
    });

    canvas.addEventListener("pointerdown", (event) => {
      const point = canvasPoint(event);
      state.reticle.x = point.x;
      state.reticle.y = point.y;
      state.reticle.visible = true;
      keepReticleInBounds();
      checkObjectCollisions();
    });

    window.addEventListener("keydown", (event) => {
      if (moveKeys.has(event.code)) {
        if (state.phase !== "running") return;
        event.preventDefault();
        state.activeKeys.add(event.code);
        nudgeReticle(event.code);
        state.reticle.visible = true;
        return;
      }

      if (event.code === "KeyP" || event.code === "Escape") {
        event.preventDefault();
        togglePause();
        return;
      }

      if (isActivationKey(event)) {
        event.preventDefault();
        if (state.phase === "running") {
          checkObjectCollisions();
        } else if (state.phase === "paused") {
          resumeGame();
        } else {
          startGame();
        }
      }
    });

    window.addEventListener("keyup", (event) => {
      if (moveKeys.has(event.code)) {
        state.activeKeys.delete(event.code);
      }
    });

    window.addEventListener("resize", resize);
  }

  function init() {
    bestEl.textContent = String(state.best);
    timerEl.textContent = String(roundLength);
    bindEvents();
    resize();
    syncGameUi();
    requestAnimationFrame(loop);
  }

  init();
})();
