const POSES = [
  { name: 'Star Power', tier: '🟢 Easy', tip: 'Open stance, arms wide, shoulders level.', difficulty: 0.86, joints: { leftShoulder: 150, rightShoulder: 150, leftElbow: 170, rightElbow: 170, leftHip: 110, rightHip: 110, leftKnee: 178, rightKnee: 178 } },
  { name: 'Hands on Hips', tier: '🟢 Easy', tip: 'Elbows out, hands parked at your waist.', difficulty: 0.82, joints: { leftShoulder: 42, rightShoulder: 42, leftElbow: 78, rightElbow: 78, leftHip: 170, rightHip: 170, leftKnee: 178, rightKnee: 178 } },
  { name: 'Lightning Reach', tier: '🟡 Medium', tip: 'One arm up, one arm low, torso tall.', difficulty: 0.74, joints: { leftShoulder: 168, rightShoulder: 35, leftElbow: 172, rightElbow: 135, leftHip: 150, rightHip: 112, leftKnee: 172, rightKnee: 150 } },
  { name: 'Disco Point', tier: '🟡 Medium', tip: 'Point high across your body and bend the opposite arm.', difficulty: 0.7, joints: { leftShoulder: 30, rightShoulder: 162, leftElbow: 70, rightElbow: 168, leftHip: 126, rightHip: 160, leftKnee: 165, rightKnee: 176 } },
  { name: 'Runner Freeze', tier: '🟡 Medium', tip: 'Freeze mid sprint with one knee lifted.', difficulty: 0.66, joints: { leftShoulder: 72, rightShoulder: 120, leftElbow: 82, rightElbow: 76, leftHip: 82, rightHip: 160, leftKnee: 72, rightKnee: 170 } },
  { name: 'Tree Balance', tier: '🔴 Hard', tip: 'Stand on one leg and angle the other knee outward.', difficulty: 0.58, joints: { leftShoulder: 176, rightShoulder: 176, leftElbow: 110, rightElbow: 110, leftHip: 58, rightHip: 174, leftKnee: 48, rightKnee: 178 } },
  { name: 'Warrior Lean', tier: '🔴 Hard', tip: 'Long stance, arms extended, front knee strong.', difficulty: 0.54, joints: { leftShoulder: 172, rightShoulder: 172, leftElbow: 176, rightElbow: 176, leftHip: 132, rightHip: 94, leftKnee: 92, rightKnee: 168 } },
  { name: 'Goalie Dive', tier: '🔴 Hard', tip: 'Drop your center and stretch both arms diagonally.', difficulty: 0.5, joints: { leftShoulder: 128, rightShoulder: 155, leftElbow: 168, rightElbow: 160, leftHip: 72, rightHip: 88, leftKnee: 78, rightKnee: 94 } },
  { name: 'Breakdance Pop', tier: '💀 Expert', tip: 'Asymmetric elbows, low hips, dramatic freeze.', difficulty: 0.42, joints: { leftShoulder: 55, rightShoulder: 148, leftElbow: 62, rightElbow: 118, leftHip: 62, rightHip: 120, leftKnee: 52, rightKnee: 138 } },
  { name: 'Buzzer Beater', tier: '💀 Expert', tip: 'Jump-shot arms with a bent balancing leg.', difficulty: 0.38, joints: { leftShoulder: 168, rightShoulder: 168, leftElbow: 94, rightElbow: 94, leftHip: 78, rightHip: 164, leftKnee: 64, rightKnee: 176 } }
];

const BONES = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28]];
const JOINTS = {
  leftShoulder: [13, 11, 23], rightShoulder: [14, 12, 24], leftElbow: [11, 13, 15], rightElbow: [12, 14, 16],
  leftHip: [11, 23, 25], rightHip: [12, 24, 26], leftKnee: [23, 25, 27], rightKnee: [24, 26, 28]
};
const state = {
  mode: 'solo', round: 1, activePose: 0, running: false, countdown: 3, total: 0,
  players: [{ name: 'Player 1', score: 0, rounds: 0 }], currentPlayer: 0, detector: null, webcamOn: false,
  lastLandmarks: null, demoPulse: 0, roomCode: 'POSE'
};

const $ = (id) => document.getElementById(id);
const targetCanvas = $('targetCanvas');
const targetCtx = targetCanvas.getContext('2d');
const overlayCanvas = $('overlayCanvas');
const overlayCtx = overlayCanvas.getContext('2d');
const video = $('webcam');

function setMode(mode) {
  state.mode = mode;
  document.querySelectorAll('.mode-card').forEach((button) => button.classList.toggle('is-active', button.dataset.mode === mode));
  $('roomCode').hidden = mode !== 'party';
  if (mode === 'party') syncPartyScore();
  renderLeaderboard();
}

function renderPose() {
  const pose = POSES[state.activePose];
  $('roundNumber').textContent = state.round;
  $('poseName').textContent = pose.name;
  $('tierPill').textContent = pose.tier;
  $('poseTip').textContent = pose.tip;
  drawTargetSilhouette(pose);
}

function drawTargetSilhouette(pose) {
  const points = synthesizeLandmarks(pose.joints, targetCanvas.width, targetCanvas.height);
  targetCtx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
  targetCtx.lineCap = 'round';
  targetCtx.lineJoin = 'round';
  BONES.forEach(([a, b]) => drawBone(targetCtx, points[a], points[b], '#42f5ff', 18));
  Object.values(points).forEach((point) => drawDot(targetCtx, point, 12, '#ff4ecd'));
}

function synthesizeLandmarks(joints, width, height) {
  const cx = width / 2;
  const y = height * 0.28;
  const shoulder = 72;
  const hip = 56;
  const upper = 82;
  const lower = 78;
  const thigh = 92;
  const shin = 94;
  const points = {
    11: { x: cx - shoulder / 2, y }, 12: { x: cx + shoulder / 2, y }, 23: { x: cx - hip / 2, y: y + 130 }, 24: { x: cx + hip / 2, y: y + 130 }
  };
  points[13] = limbPoint(points[11], joints.leftShoulder, upper, -1);
  points[15] = limbPoint(points[13], joints.leftElbow, lower, -1);
  points[14] = limbPoint(points[12], 180 - joints.rightShoulder, upper, 1);
  points[16] = limbPoint(points[14], 180 - joints.rightElbow, lower, 1);
  points[25] = limbPoint(points[23], 90 + (180 - joints.leftHip) * 0.65, thigh, -1);
  points[27] = limbPoint(points[25], 90 + (180 - joints.leftKnee) * 0.8, shin, -1);
  points[26] = limbPoint(points[24], 90 - (180 - joints.rightHip) * 0.65, thigh, 1);
  points[28] = limbPoint(points[26], 90 - (180 - joints.rightKnee) * 0.8, shin, 1);
  return points;
}

function limbPoint(origin, degrees, length, side) {
  const radians = (degrees + side * 20) * Math.PI / 180;
  return { x: origin.x + Math.cos(radians) * length, y: origin.y - Math.sin(radians) * length };
}

function drawBone(ctx, a, b, color, width) {
  if (!a || !b) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function drawDot(ctx, point, radius, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
  ctx.fill();
}

async function enableCamera() {
  $('cameraStatus').textContent = 'Loading AI model';
  const vision = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14');
  try {
    const resolver = await vision.FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');
    state.detector = await vision.PoseLandmarker.createFromOptions(resolver, {
      baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task' },
      runningMode: 'VIDEO', numPoses: 1
    });
    video.srcObject = await navigator.mediaDevices.getUserMedia({ video: { width: 960, height: 720 }, audio: false });
    await video.play();
    state.webcamOn = true;
    $('cameraHelp').classList.add('is-hidden');
    $('cameraStatus').textContent = 'AI tracking live';
    $('aiStatus').textContent = 'MediaPipe live';
    requestAnimationFrame(detectPose);
  } catch (error) {
    console.error(error);
    $('cameraStatus').textContent = 'Demo mode active';
    $('aiStatus').textContent = 'Camera unavailable';
    $('cameraHelp').innerHTML = '<strong>Camera unavailable.</strong><span>Use Demo score to play with simulated pose accuracy.</span>';
  }
}

function detectPose() {
  if (!state.webcamOn || !state.detector) return;
  const result = state.detector.detectForVideo(video, performance.now());
  state.lastLandmarks = result.landmarks?.[0] ?? null;
  drawLiveOverlay(state.lastLandmarks);
  updateLiveAccuracy();
  requestAnimationFrame(detectPose);
}

function drawLiveOverlay(landmarks) {
  overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  if (!landmarks) return;
  const points = landmarks.map((landmark) => ({ x: landmark.x * overlayCanvas.width, y: landmark.y * overlayCanvas.height, visibility: landmark.visibility ?? 1 }));
  BONES.forEach(([a, b]) => drawBone(overlayCtx, points[a], points[b], '#beff4a', 8));
  points.forEach((point) => point.visibility > 0.45 && drawDot(overlayCtx, point, 5, '#42f5ff'));
}

function calculateAccuracy() {
  if (!state.lastLandmarks) return demoAccuracy();
  const pose = POSES[state.activePose];
  const scores = Object.entries(JOINTS).map(([name, indexes]) => {
    const playerAngle = angleBetween(...indexes.map((index) => state.lastLandmarks[index]));
    const targetAngle = pose.joints[name];
    const diff = Math.min(Math.abs(playerAngle - targetAngle), 180);
    return Math.max(0, 1 - diff / 90);
  });
  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length * 100);
}

function angleBetween(a, b, c) {
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const mag = Math.hypot(ab.x, ab.y) * Math.hypot(cb.x, cb.y);
  return Math.acos(Math.max(-1, Math.min(1, dot / mag))) * 180 / Math.PI;
}

function demoAccuracy() {
  const pose = POSES[state.activePose];
  const wave = (Math.sin(Date.now() / 350 + state.demoPulse) + 1) / 2;
  return Math.round((35 + wave * 55) * pose.difficulty + 12);
}

function updateLiveAccuracy(forcedScore) {
  const accuracy = forcedScore ?? calculateAccuracy();
  $('accuracyText').textContent = `${accuracy}%`;
  $('meterFill').style.width = `${accuracy}%`;
  $('ratingText').textContent = ratingFor(accuracy);
}

function ratingFor(score) {
  if (score >= 90) return '⭐ Perfect!';
  if (score >= 70) return '✅ Great!';
  if (score >= 50) return '👍 Good';
  return '😬 Miss';
}

function startMatch() {
  state.running = true;
  state.round = 1;
  state.activePose = 0;
  state.total = 0;
  state.players.forEach((player) => { player.score = 0; player.rounds = 0; });
  $('totalScore').textContent = '0';
  nextCountdown();
  renderLeaderboard();
}

function nextCountdown() {
  renderPose();
  state.countdown = 3;
  $('countdown').textContent = state.countdown;
  const timer = setInterval(() => {
    state.countdown -= 1;
    $('countdown').textContent = state.countdown > 0 ? state.countdown : 'POSE!';
    if (state.countdown <= 0) {
      clearInterval(timer);
      scoreRound();
    }
  }, 1000);
}

function scoreRound() {
  const score = calculateAccuracy();
  updateLiveAccuracy(score);
  const player = state.players[state.currentPlayer];
  player.score += score;
  player.rounds += 1;
  state.total = state.players.reduce((sum, item) => sum + item.score, 0);
  $('totalScore').textContent = state.total;
  syncPartyScore();
  renderLeaderboard();
  if (state.round >= 10) {
    state.running = false;
    $('countdown').textContent = 'GG';
    return;
  }
  state.round += 1;
  state.activePose = Math.min(POSES.length - 1, state.round - 1);
  if (state.mode === 'hotseat') state.currentPlayer = (state.currentPlayer + 1) % state.players.length;
  setTimeout(nextCountdown, 1200);
}

function renderLeaderboard() {
  const localRows = state.players.map((player) => ({ ...player, source: state.mode === 'hotseat' ? 'Hot seat' : state.mode === 'party' ? state.roomCode : 'Solo' }));
  const partyRows = state.mode === 'party' ? readPartyScores().filter((row) => !localRows.some((player) => player.name === row.name)) : [];
  const rows = [...localRows, ...partyRows].sort((a, b) => b.score - a.score);
  $('leaderboard').innerHTML = rows.map((player, index) => `
    <li><span class="rank">#${index + 1}</span><span class="player-meta"><strong>${escapeHtml(player.name)}</strong><small>${player.source} · ${player.rounds} rounds</small></span><span class="points">${player.score}</span></li>
  `).join('');
}

function addPlayer() {
  const base = $('playerName').value.trim() || `Player ${state.players.length + 1}`;
  state.players.push({ name: base, score: 0, rounds: 0 });
  $('playerName').value = `Player ${state.players.length + 1}`;
  setMode('hotseat');
  renderLeaderboard();
}

function demoScore() {
  state.demoPulse += 1.7;
  updateLiveAccuracy(Math.min(100, calculateAccuracy() + Math.round(Math.random() * 18)));
}

function syncPartyScore() {
  if (state.mode !== 'party') return;
  const scores = readPartyScores().filter((row) => row.name !== state.players[0].name);
  scores.push({ name: state.players[0].name, score: state.players[0].score, rounds: state.players[0].rounds, source: state.roomCode });
  localStorage.setItem('pose-match-party', JSON.stringify(scores));
}

function readPartyScores() {
  try { return JSON.parse(localStorage.getItem('pose-match-party')) ?? []; } catch { return []; }
}

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

document.querySelectorAll('.mode-card').forEach((button) => button.addEventListener('click', () => setMode(button.dataset.mode)));
$('cameraBtn').addEventListener('click', () => enableCamera().catch((error) => {
  console.error(error);
  $('cameraStatus').textContent = 'Demo mode active';
  $('aiStatus').textContent = 'AI import unavailable';
  $('cameraHelp').innerHTML = '<strong>AI model unavailable.</strong><span>Use Demo score to play with simulated pose accuracy.</span>';
}));
$('startBtn').addEventListener('click', startMatch);
$('demoBtn').addEventListener('click', demoScore);
$('addPlayerBtn').addEventListener('click', addPlayer);
$('resetBtn').addEventListener('click', () => {
  localStorage.removeItem('pose-match-party');
  state.players = [{ name: 'Player 1', score: 0, rounds: 0 }];
  state.currentPlayer = 0;
  state.total = 0;
  $('totalScore').textContent = '0';
  renderLeaderboard();
});
window.addEventListener('storage', renderLeaderboard);

renderPose();
renderLeaderboard();
updateLiveAccuracy(0);
