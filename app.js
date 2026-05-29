(() => {
  "use strict";

  const gameCanvas = document.querySelector("#gameCanvas");
  const gameCtx = gameCanvas.getContext("2d");
  const video = document.querySelector("#webcam");
  const handCanvas = document.querySelector("#handCanvas");
  const handCtx = handCanvas.getContext("2d");

  const scoreEl = document.querySelector("#score");
  const bestEl = document.querySelector("#best");
  const controlStateEl = document.querySelector("#controlState");
  const cameraStatusEl = document.querySelector("#cameraStatus");
  const handStatusEl = document.querySelector("#handStatus");
  const trackingDot = document.querySelector("#trackingDot");
  const startPanel = document.querySelector("#startPanel");
  const menuTitle = document.querySelector("#menuTitle");
  const menuIntro = document.querySelector("#menuIntro");
  const menuHint = document.querySelector("#menuHint");
  const gameMessage = document.querySelector("#gameMessage");
  const messageTitle = document.querySelector("#messageTitle");
  const messageText = document.querySelector("#messageText");
  const cameraButton = document.querySelector("#cameraButton");
  const playButton = document.querySelector("#playButton");
  const mainMenuButton = document.querySelector("#mainMenuButton");

  const colors = {
    skyTop: "#73d8f4",
    skyBottom: "#c6f0da",
    cloud: "rgba(255, 255, 255, 0.78)",
    hillBack: "#77cb7e",
    hillFront: "#43b36a",
    pipe: "#38a967",
    pipeDark: "#1e7f51",
    ground: "#f0bb63",
    groundLine: "#d99a4e",
    bird: "#ffd15c",
    birdWing: "#f65f5f",
    birdDark: "#17212b",
    berry: "#7b4df4",
  };

  const game = {
    width: 960,
    height: 600,
    dpr: 1,
    running: false,
    over: false,
    score: 0,
    best: Number(localStorage.getItem("handFlappyBest") || 0),
    lastFrame: 0,
    pipeTimer: 0,
    handY: null,
    handSeenAt: 0,
    countdown: 0,
    clouds: [],
    pipes: [],
    bird: {
      x: 210,
      y: 300,
      radius: 18,
      vy: 0,
      rotation: 0,
      wing: 0,
    },
  };

  let pose = null;
  let cameraStream = null;
  let cameraFrameId = null;
  let cameraStarted = false;
  let sendingFrame = false;
  let gameStartedOnce = false;
  let controlMode = "keyboard";
  let menuMode = "initial";
  let countdownTimer = null;
  const handMotion = {
    lastArmY: null,
    lastAverageY: null,
    lastWristSpread: null,
    clapArmed: false,
    lastTime: 0,
    lastFlapAt: 0,
    lastClapAt: 0,
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function setStatus(kind, text) {
    if (kind === "camera") cameraStatusEl.textContent = text;
    if (kind === "hand") handStatusEl.textContent = text;
  }

  function setMenu({ mode, title, intro, primary, secondary, hint }) {
    menuMode = mode;
    menuTitle.textContent = title;
    menuIntro.textContent = intro;
    cameraButton.textContent = primary;
    playButton.hidden = !secondary;
    if (secondary) playButton.textContent = secondary;
    menuHint.textContent = hint;
  }

  function showInitialMenu() {
    setMenu({
      mode: "initial",
      title: "Ready to fly?",
      intro: "Press play to set up camera arm tracking. You can choose Camera or Keyboard next.",
      primary: "Play",
      secondary: "",
      hint: "Your video stays in the browser.",
    });
  }

  function showControlChoice() {
    setMenu({
      mode: "choice",
      title: "Choose controls",
      intro: "Camera is ready. Use both arms like wings, or choose Keyboard.",
      primary: "Camera",
      secondary: "Keyboard",
      hint: "Camera mode watches shoulders, elbows, and wrists. Keyboard mode uses spacebar, click, or tap.",
    });
  }

  function showCameraBlocked(errorMessage) {
    setMenu({
      mode: "blocked",
      title: "Camera blocked",
      intro: errorMessage,
      primary: "Try camera again",
      secondary: "Keyboard",
      hint: "You can allow camera access from the browser address bar and try again.",
    });
  }

  function resizeGame() {
    const bounds = gameCanvas.getBoundingClientRect();
    game.width = Math.max(320, bounds.width);
    game.height = Math.max(420, bounds.height);
    game.dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

    gameCanvas.width = Math.round(game.width * game.dpr);
    gameCanvas.height = Math.round(game.height * game.dpr);
    gameCtx.setTransform(game.dpr, 0, 0, game.dpr, 0, 0);

    game.bird.x = game.width * 0.24;
    if (!game.running) game.bird.y = game.height * 0.48;
  }

  function resetGame() {
    clearCountdown();
    game.running = true;
    game.over = false;
    game.score = 0;
    game.pipeTimer = 0;
    game.pipes = [];
    game.clouds = [
      { x: game.width * 0.12, y: game.height * 0.2, size: 1.2, speed: 14 },
      { x: game.width * 0.58, y: game.height * 0.12, size: 0.8, speed: 19 },
      { x: game.width * 0.84, y: game.height * 0.32, size: 1, speed: 12 },
    ];
    game.bird.y = game.height * 0.48;
    game.bird.vy = 0;
    game.bird.rotation = 0;
    game.bird.wing = 0;
    scoreEl.textContent = "0";
    gameMessage.hidden = true;
    startPanel.hidden = true;
    cameraButton.disabled = false;
    gameStartedOnce = true;
    spawnPipe();
    game.lastFrame = performance.now();
  }

  function endGame() {
    clearCountdown();
    game.running = false;
    game.over = true;
    game.best = Math.max(game.best, game.score);
    localStorage.setItem("handFlappyBest", String(game.best));
    bestEl.textContent = String(game.best);
    messageTitle.textContent = "Game over";
    messageText.textContent = controlMode === "camera" ? "Clap your hands to restart." : "Press space, click, or tap to restart.";
    gameMessage.hidden = false;
  }

  function flap() {
    if (game.over) {
      beginReadyCountdown(controlMode);
      return;
    }

    if (!game.running) return;
    game.bird.vy = -430;
  }

  function spawnPipe() {
    const gap = clamp(game.height * 0.28, 135, 190);
    const topMin = 78;
    const topMax = game.height - gap - 138;
    const topHeight = topMin + Math.random() * Math.max(80, topMax - topMin);
    const pipeWidth = clamp(game.width * 0.08, 58, 84);

    game.pipes.push({
      x: game.width + pipeWidth,
      width: pipeWidth,
      top: topHeight,
      bottom: topHeight + gap,
      scored: false,
    });
  }

  function update(dt) {
    const bird = game.bird;
    bird.vy += 1420 * dt;
    controlStateEl.textContent = controlMode === "camera" ? "Camera" : "Keyboard";

    bird.vy = clamp(bird.vy, -620, 720);
    bird.y += bird.vy * dt;
    bird.rotation = clamp(bird.vy / 620, -0.55, 0.9);
    bird.wing += dt * 12;

    const speed = clamp(game.width * 0.32, 230, 330);
    game.pipeTimer += dt;
    if (game.pipeTimer > 1.45) {
      spawnPipe();
      game.pipeTimer = 0;
    }

    for (const pipe of game.pipes) {
      pipe.x -= speed * dt;
      if (!pipe.scored && pipe.x + pipe.width < bird.x - bird.radius) {
        pipe.scored = true;
        game.score += 1;
        scoreEl.textContent = String(game.score);
      }
    }

    game.pipes = game.pipes.filter((pipe) => pipe.x + pipe.width > -40);

    for (const cloud of game.clouds) {
      cloud.x -= cloud.speed * dt;
      if (cloud.x < -150) {
        cloud.x = game.width + 150;
        cloud.y = 55 + Math.random() * game.height * 0.28;
      }
    }

    if (collides()) endGame();
  }

  function collides() {
    const bird = game.bird;
    const ground = game.height - 58;
    if (bird.y - bird.radius < 0 || bird.y + bird.radius > ground) return true;

    for (const pipe of game.pipes) {
      const inX = bird.x + bird.radius > pipe.x && bird.x - bird.radius < pipe.x + pipe.width;
      const inPipeY = bird.y - bird.radius < pipe.top || bird.y + bird.radius > pipe.bottom;
      if (inX && inPipeY) return true;
    }

    return false;
  }

  function draw() {
    const w = game.width;
    const h = game.height;
    gameCtx.setTransform(game.dpr, 0, 0, game.dpr, 0, 0);
    gameCtx.clearRect(0, 0, w, h);

    const sky = gameCtx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, colors.skyTop);
    sky.addColorStop(1, colors.skyBottom);
    gameCtx.fillStyle = sky;
    gameCtx.fillRect(0, 0, w, h);

    drawSun(w - 96, 86, 44);
    game.clouds.forEach(drawCloud);
    drawHills();
    game.pipes.forEach(drawPipe);
    drawGround();
    drawBird();
    drawHandGuide();
    drawCountdown();
  }

  function drawCountdown() {
    if (!game.countdown) return;

    gameCtx.save();
    gameCtx.fillStyle = "rgba(23, 33, 43, 0.22)";
    gameCtx.fillRect(0, 0, game.width, game.height);
    gameCtx.fillStyle = "rgba(255, 255, 255, 0.92)";
    gameCtx.strokeStyle = "rgba(23, 33, 43, 0.16)";
    gameCtx.lineWidth = 3;
    gameCtx.beginPath();
    roundedRect(gameCtx, game.width / 2 - 82, game.height / 2 - 82, 164, 164, 8);
    gameCtx.fill();
    gameCtx.stroke();

    gameCtx.fillStyle = colors.berry;
    gameCtx.font = "900 78px Inter, system-ui, sans-serif";
    gameCtx.textAlign = "center";
    gameCtx.textBaseline = "middle";
    gameCtx.fillText(String(game.countdown), game.width / 2, game.height / 2 - 10);
    gameCtx.fillStyle = colors.birdDark;
    gameCtx.font = "800 16px Inter, system-ui, sans-serif";
    gameCtx.fillText("Get ready", game.width / 2, game.height / 2 + 54);
    gameCtx.restore();
  }

  function roundedRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
  }

  function resetWingMotion() {
    handMotion.lastArmY = null;
    handMotion.lastAverageY = null;
    handMotion.lastWristSpread = null;
    handMotion.clapArmed = false;
    handMotion.lastTime = 0;
    handMotion.lastFlapAt = 0;
    handMotion.lastClapAt = 0;
  }

  function clearCountdown() {
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
    game.countdown = 0;
  }

  function drawSun(x, y, r) {
    gameCtx.fillStyle = "#ffd15c";
    gameCtx.beginPath();
    gameCtx.arc(x, y, r, 0, Math.PI * 2);
    gameCtx.fill();
  }

  function drawCloud(cloud) {
    gameCtx.save();
    gameCtx.translate(cloud.x, cloud.y);
    gameCtx.scale(cloud.size, cloud.size);
    gameCtx.fillStyle = colors.cloud;
    gameCtx.beginPath();
    gameCtx.arc(0, 18, 24, 0, Math.PI * 2);
    gameCtx.arc(28, 5, 31, 0, Math.PI * 2);
    gameCtx.arc(66, 19, 23, 0, Math.PI * 2);
    gameCtx.rect(-4, 18, 76, 25);
    gameCtx.fill();
    gameCtx.restore();
  }

  function drawHills() {
    const h = game.height;
    const w = game.width;
    gameCtx.fillStyle = colors.hillBack;
    gameCtx.beginPath();
    gameCtx.moveTo(0, h - 92);
    gameCtx.quadraticCurveTo(w * 0.22, h - 178, w * 0.46, h - 94);
    gameCtx.quadraticCurveTo(w * 0.72, h - 15, w, h - 120);
    gameCtx.lineTo(w, h);
    gameCtx.lineTo(0, h);
    gameCtx.fill();

    gameCtx.fillStyle = colors.hillFront;
    gameCtx.beginPath();
    gameCtx.moveTo(0, h - 72);
    gameCtx.quadraticCurveTo(w * 0.2, h - 124, w * 0.42, h - 72);
    gameCtx.quadraticCurveTo(w * 0.68, h - 18, w, h - 82);
    gameCtx.lineTo(w, h);
    gameCtx.lineTo(0, h);
    gameCtx.fill();
  }

  function drawPipe(pipe) {
    gameCtx.fillStyle = colors.pipe;
    gameCtx.strokeStyle = colors.pipeDark;
    gameCtx.lineWidth = 4;

    drawPipePart(pipe.x, -6, pipe.width, pipe.top + 6, true);
    drawPipePart(pipe.x, pipe.bottom, pipe.width, game.height - pipe.bottom - 58, false);
  }

  function drawPipePart(x, y, width, height, topPipe) {
    const lipHeight = 22;
    const lipY = topPipe ? y + height - lipHeight : y;
    const bodyY = topPipe ? y : y + lipHeight;
    const bodyHeight = topPipe ? height - lipHeight : height - lipHeight;

    gameCtx.fillRect(x, bodyY, width, bodyHeight);
    gameCtx.strokeRect(x, bodyY, width, bodyHeight);
    gameCtx.fillRect(x - 8, lipY, width + 16, lipHeight);
    gameCtx.strokeRect(x - 8, lipY, width + 16, lipHeight);

    gameCtx.fillStyle = "rgba(255, 255, 255, 0.18)";
    gameCtx.fillRect(x + width * 0.18, bodyY + 10, width * 0.16, Math.max(10, bodyHeight - 20));
    gameCtx.fillStyle = colors.pipe;
  }

  function drawGround() {
    const y = game.height - 58;
    gameCtx.fillStyle = colors.ground;
    gameCtx.fillRect(0, y, game.width, 58);
    gameCtx.fillStyle = colors.groundLine;
    for (let x = -20; x < game.width + 40; x += 42) {
      gameCtx.fillRect(x, y + 15, 24, 6);
    }
  }

  function drawBird() {
    const bird = game.bird;
    gameCtx.save();
    gameCtx.translate(bird.x, bird.y);
    gameCtx.rotate(bird.rotation);

    gameCtx.fillStyle = "rgba(23, 33, 43, 0.16)";
    gameCtx.beginPath();
    gameCtx.ellipse(3, 22, 27, 8, 0, 0, Math.PI * 2);
    gameCtx.fill();

    gameCtx.fillStyle = colors.bird;
    gameCtx.strokeStyle = colors.birdDark;
    gameCtx.lineWidth = 3;
    gameCtx.beginPath();
    gameCtx.arc(0, 0, bird.radius, 0, Math.PI * 2);
    gameCtx.fill();
    gameCtx.stroke();

    const wingLift = Math.sin(bird.wing) * 5;
    gameCtx.fillStyle = colors.birdWing;
    gameCtx.beginPath();
    gameCtx.ellipse(-7, 7 + wingLift, 13, 8, -0.4, 0, Math.PI * 2);
    gameCtx.fill();
    gameCtx.stroke();

    gameCtx.fillStyle = "#fff";
    gameCtx.beginPath();
    gameCtx.arc(9, -7, 6, 0, Math.PI * 2);
    gameCtx.fill();
    gameCtx.fillStyle = colors.birdDark;
    gameCtx.beginPath();
    gameCtx.arc(11, -7, 2.4, 0, Math.PI * 2);
    gameCtx.fill();

    gameCtx.fillStyle = "#ff9f3d";
    gameCtx.beginPath();
    gameCtx.moveTo(17, 0);
    gameCtx.lineTo(31, 5);
    gameCtx.lineTo(17, 10);
    gameCtx.closePath();
    gameCtx.fill();
    gameCtx.stroke();
    gameCtx.restore();
  }

  function drawHandGuide() {
    const fresh = performance.now() - game.handSeenAt < 220;
    if (controlMode !== "camera" || !fresh || game.handY === null || !game.running) return;

    gameCtx.save();
    gameCtx.strokeStyle = "rgba(123, 77, 244, 0.32)";
    gameCtx.lineWidth = 3;
    gameCtx.setLineDash([8, 10]);
    gameCtx.beginPath();
    gameCtx.moveTo(0, game.handY);
    gameCtx.lineTo(game.width, game.handY);
    gameCtx.stroke();
    gameCtx.fillStyle = colors.berry;
    gameCtx.beginPath();
    gameCtx.arc(game.bird.x - 48, game.handY, 7, 0, Math.PI * 2);
    gameCtx.fill();
    gameCtx.restore();
  }

  function loop(now) {
    const dt = Math.min(0.033, (now - game.lastFrame) / 1000 || 0);
    game.lastFrame = now;
    if (game.running) update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  function cameraErrorMessage(error) {
    if (!navigator.mediaDevices?.getUserMedia) {
      return "This browser does not support webcam access. Try Chrome, Edge, or Firefox.";
    }

    switch (error?.name) {
      case "NotAllowedError":
      case "SecurityError":
        return "Camera permission was blocked. Allow camera access for this site, or open this URL in Chrome or Edge.";
      case "NotFoundError":
      case "DevicesNotFoundError":
        return "No camera was found on this device.";
      case "NotReadableError":
      case "TrackStartError":
        return "The camera is already in use by another app or browser tab.";
      case "OverconstrainedError":
      case "ConstraintNotSatisfiedError":
        return "This camera could not match the requested video settings.";
      default:
        return error?.message || "Camera access failed. Keyboard controls are ready.";
    }
  }

  function stopCameraStream() {
    if (cameraFrameId) {
      cancelAnimationFrame(cameraFrameId);
      cameraFrameId = null;
    }

    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      cameraStream = null;
    }

    video.srcObject = null;
    sendingFrame = false;
  }

  function waitForVideoReady() {
    if (video.readyState >= 2) return Promise.resolve();

    return new Promise((resolve) => {
      video.onloadedmetadata = () => {
        resolve();
      };
    });
  }

  async function startCameraStream() {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("This browser does not support webcam access.");
    }

    cameraStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: "user",
        width: { ideal: 1280 },
        height: { ideal: 720 },
        aspectRatio: { ideal: 16 / 9 },
      },
    });

    video.srcObject = cameraStream;
    await waitForVideoReady();
    await video.play();
  }

  function startHandTrackingLoop() {
    const trackFrame = async () => {
      if (!cameraStarted || !pose) return;

      if (video.readyState >= 2 && !video.paused && !sendingFrame) {
        sendingFrame = true;
        try {
          await pose.send({ image: video });
        } finally {
          sendingFrame = false;
        }
      }

      cameraFrameId = requestAnimationFrame(trackFrame);
    };

    cameraFrameId = requestAnimationFrame(trackFrame);
  }

  function beginReadyCountdown(mode) {
    controlMode = mode;
    controlStateEl.textContent = mode === "camera" ? "Camera" : "Keyboard";
    clearCountdown();
    game.running = false;
    game.over = false;
    gameMessage.hidden = true;
    startPanel.hidden = true;

    let secondsLeft = 5;
    game.countdown = secondsLeft;
    cameraButton.disabled = false;

    countdownTimer = window.setInterval(() => {
      secondsLeft -= 1;
      if (secondsLeft <= 0) {
        clearCountdown();
        resetGame();
        return;
      }

      game.countdown = secondsLeft;
    }, 1000);
  }

  function restartFromGameOver(source) {
    if (!game.over) return;
    setStatus("hand", source === "clap" ? "Clap detected. Restarting..." : "Restarting...");
    beginReadyCountdown(controlMode);
  }

  function returnToMainMenu() {
    clearCountdown();
    stopCameraStream();
    cameraStarted = false;
    controlMode = "keyboard";
    game.running = false;
    game.over = false;
    gameMessage.hidden = true;
    startPanel.hidden = false;
    cameraButton.disabled = false;
    scoreEl.textContent = "0";
    showInitialMenu();
    setStatus("camera", "Camera idle");
    setStatus("hand", "No pose yet");
  }

  async function startCamera() {
    if (!window.Pose) {
      setStatus("camera", "MediaPipe did not load. Check your connection.");
      showCameraBlocked("MediaPipe did not load. Refresh the page, then try again.");
      return;
    }

    cameraButton.disabled = true;
    cameraButton.textContent = "Waiting for permission...";
    playButton.hidden = true;
    setStatus("camera", "Please allow camera access in your browser.");

    try {
      pose = new Pose({
        locateFile: (file) => `/node_modules/@mediapipe/pose/${file}`,
      });

      pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        minDetectionConfidence: 0.68,
        minTrackingConfidence: 0.62,
      });

      pose.onResults(onPoseResults);

      await startCameraStream();
      cameraStarted = true;
      startHandTrackingLoop();
      cameraButton.disabled = false;
      setStatus("camera", "Camera running");
      setStatus("hand", "Show both arms, then choose Camera.");
      showControlChoice();
    } catch (error) {
      stopCameraStream();
      cameraStarted = false;
      cameraButton.disabled = false;
      setStatus("camera", "Camera unavailable. Keyboard controls are ready.");
      const errorMessage = cameraErrorMessage(error);
      setStatus("hand", errorMessage);
      showCameraBlocked(errorMessage);
    }
  }

  function startGameWithControl(mode) {
    controlMode = mode;

    if (mode === "keyboard") {
      stopCameraStream();
      cameraStarted = false;
      game.handY = null;
      game.handSeenAt = 0;
      resetWingMotion();
      trackingDot.hidden = true;
      handCtx.clearRect(0, 0, handCanvas.width, handCanvas.height);
      setStatus("camera", "Keyboard mode");
      setStatus("hand", "Spacebar, click, or tap to flap.");
    } else {
      setStatus("camera", "Camera running");
      resetWingMotion();
      setStatus("hand", "Flap both arms like wings.");
    }

    beginReadyCountdown(mode);
  }

  function isLandmarkVisible(landmark, threshold = 0.35) {
    return Boolean(landmark) && (landmark.visibility === undefined || landmark.visibility > threshold);
  }

  function onPoseResults(results) {
    const sourceWidth = video.videoWidth || 640;
    const sourceHeight = video.videoHeight || 480;
    if (handCanvas.width !== sourceWidth || handCanvas.height !== sourceHeight) {
      handCanvas.width = sourceWidth;
      handCanvas.height = sourceHeight;
    }

    handCtx.save();
    handCtx.clearRect(0, 0, handCanvas.width, handCanvas.height);
    handCtx.lineWidth = 4;

    const landmarks = results.poseLandmarks || [];
    const torsoAndElbows = [11, 12, 13, 14].map((index) => landmarks[index]);
    const wrists = [15, 16].map((index) => landmarks[index]);
    const upperBody = [...torsoAndElbows, ...wrists];
    const armsVisible = torsoAndElbows.every((landmark) => isLandmarkVisible(landmark, 0.32)) && wrists.every((landmark) => isLandmarkVisible(landmark, 0.08));

    if (armsVisible) {
      const now = performance.now();
      const leftShoulder = landmarks[11];
      const rightShoulder = landmarks[12];
      const leftElbow = landmarks[13];
      const rightElbow = landmarks[14];
      const leftWrist = landmarks[15];
      const rightWrist = landmarks[16];
      const wristAverageX = (leftWrist.x + rightWrist.x) / 2;
      const wristAverageY = (leftWrist.y + rightWrist.y) / 2;
      const armAverageY = (leftElbow.y + rightElbow.y + leftWrist.y + rightWrist.y) / 4;
      const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);
      const wristSpread = Math.abs(leftWrist.x - rightWrist.x);
      const armsWide = wristSpread > shoulderWidth * 1.2;

      game.handY = armAverageY * game.height;
      game.handSeenAt = now;
      trackingDot.hidden = false;
      trackingDot.style.left = `${(1 - wristAverageX) * 100}%`;
      trackingDot.style.top = `${wristAverageY * 100}%`;

      if (window.drawConnectors && window.POSE_CONNECTIONS) {
        drawConnectors(handCtx, landmarks, POSE_CONNECTIONS, {
          color: "rgba(123, 77, 244, 0.72)",
          lineWidth: 4,
        });
      }
      if (window.drawLandmarks) {
        drawLandmarks(handCtx, upperBody, {
          color: "#ffd15c",
          lineWidth: 2,
          radius: 5,
        });
      }

      setStatus("hand", armsWide ? "Arms locked. Flap both wings." : "Spread both arms wider for Camera mode.");

      if (controlMode === "camera") {
        const elapsed = Math.max(16, now - handMotion.lastTime);
        const armDelta = handMotion.lastArmY === null ? 0 : armAverageY - handMotion.lastArmY;
        const wristDelta = handMotion.lastAverageY === null ? 0 : wristAverageY - handMotion.lastAverageY;
        const clapReadySpread = Math.max(shoulderWidth * 0.56, 0.12);
        const clapCloseSpread = Math.max(shoulderWidth * 0.52, 0.105);
        const spreadDelta = handMotion.lastWristSpread === null ? 0 : handMotion.lastWristSpread - wristSpread;
        const handsApart = wristSpread > clapReadySpread;
        const clapClosed = wristSpread < clapCloseSpread;
        const closingFast = spreadDelta > Math.max(shoulderWidth * 0.08, 0.024);
        if (game.over && handsApart) {
          handMotion.clapArmed = true;
          setStatus("hand", "Hands apart. Clap to restart.");
        }
        const clapStarted = handMotion.clapArmed && clapClosed && (closingFast || wristSpread < Math.max(shoulderWidth * 0.42, 0.09));
        const clapCooledDown = now - handMotion.lastClapAt > 900;
        const strongBeat =
          armsWide &&
          Math.abs(armDelta) > 0.026 &&
          Math.abs(wristDelta) > 0.034 &&
          Math.abs(wristDelta / elapsed) > 0.00026;
        const cooledDown = now - handMotion.lastFlapAt > 360;

        if (game.over && clapStarted && clapCooledDown) {
          handMotion.lastClapAt = now;
          handMotion.clapArmed = false;
          restartFromGameOver("clap");
        } else if (game.running && cooledDown && strongBeat) {
          flap();
          handMotion.lastFlapAt = now;
          setStatus("hand", "Wing flap detected.");
        }
      }

      handMotion.lastArmY = armAverageY;
      handMotion.lastAverageY = wristAverageY;
      handMotion.lastWristSpread = wristSpread;
      handMotion.lastTime = now;
    } else {
      trackingDot.hidden = true;
      if (performance.now() - game.handSeenAt > 350) {
        setStatus("hand", game.over ? "Open your arms, then clap before your hands overlap." : "Step back so shoulders, elbows, and wrists are visible.");
      }
      if (!game.over) resetWingMotion();
    }

    handCtx.restore();
  }

  function bindControls() {
    cameraButton.addEventListener("click", () => {
      if (menuMode === "choice" && cameraStarted) {
        startGameWithControl("camera");
      } else {
        startCamera();
      }
    });

    playButton.addEventListener("click", () => {
      startGameWithControl("keyboard");
    });

    mainMenuButton.addEventListener("click", () => {
      returnToMainMenu();
    });

    window.addEventListener("keydown", (event) => {
      if (event.code === "Space" || event.code === "ArrowUp") {
        event.preventDefault();
        flap();
      }
    });

    gameCanvas.addEventListener("pointerdown", () => {
      flap();
    });

    window.addEventListener("resize", () => {
      resizeGame();
      draw();
    });
  }

  function init() {
    bestEl.textContent = String(game.best);
    showInitialMenu();
    resizeGame();
    bindControls();
    draw();
    requestAnimationFrame(loop);
  }

  init();
})();
