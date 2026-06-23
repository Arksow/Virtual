import "./styles.css";

const tiles = [
  { name: "PULSE", color: "cyan" }, { name: "SURGE", color: "pink" }, { name: "SPARK", color: "orange" },
  { name: "FOCUS", color: "violet" }, { name: "RISE", color: "green" }, { name: "FLOW", color: "blue" },
];
const board = document.querySelector("#board");
const start = document.querySelector("#start");
const reset = document.querySelector("#reset");
const status = document.querySelector("#status");
const timer = document.querySelector("#timer");
const timerState = document.querySelector("#timer-state");
const roundLabel = document.querySelector("#round");
const strip = document.querySelector("#sequence-strip");
const ladder = document.querySelector("#ladder");
const players = document.querySelector("#players");
const best = document.querySelector("#best");

let sequence = [], input = [], round = 1, teamSize = 3, phase = "ready", startedAt = 0, interval, bestTime = null;
const buttons = tiles.map((tile, index) => {
  const button = document.createElement("button");
  button.className = `tile ${tile.color}`;
  button.dataset.index = index;
  button.innerHTML = `<span class="tile-index">0${index + 1}</span><strong>${tile.name}</strong>`;
  button.addEventListener("click", () => choose(index));
  board.append(button);
  return button;
});

function renderTeam() {
  players.innerHTML = "";
  const colors = ["cyan", "pink", "orange", "violet", "green", "blue"];
  for (let i = 0; i < teamSize; i++) {
    const item = document.createElement("div");
    item.className = "player";
    item.innerHTML = `<span class="avatar ${colors[i]}">${i + 1}</span><span>PLAYER ${i + 1}</span>`;
    players.append(item);
  }
}
function renderLadder() {
  ladder.innerHTML = "";
  for (let i = 6; i >= 1; i--) {
    const node = document.createElement("span");
    node.textContent = String(i).padStart(2, "0");
    if (i === round) node.className = "current";
    if (i < round) node.className = "done";
    ladder.append(node);
  }
}
function showStrip(show = false) {
  strip.innerHTML = "";
  sequence.forEach((tile, i) => {
    const dot = document.createElement("span");
    dot.className = `sequence-dot ${show || i < input.length ? tiles[tile].color : "hidden"}`;
    strip.append(dot);
  });
}
function format(ms) { const tenths = Math.floor(ms / 100) % 10; const secs = Math.floor(ms / 1000); return `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}.${tenths}`; }
function setBoardLocked(locked) { buttons.forEach((button) => button.disabled = locked); }
async function flash(index) {
  buttons[index].classList.add("lit");
  await new Promise(r => setTimeout(r, 480));
  buttons[index].classList.remove("lit");
  await new Promise(r => setTimeout(r, 170));
}
async function playSequence() {
  phase = "showing"; setBoardLocked(true); status.textContent = "WATCH THE PATTERN"; timerState.textContent = "MEMORISE"; showStrip(true);
  await new Promise(r => setTimeout(r, 650));
  for (const index of sequence) await flash(index);
  phase = "playing"; input = []; setBoardLocked(false); showStrip(); startedAt = performance.now();
  interval = setInterval(() => timer.textContent = format(performance.now() - startedAt), 50);
  status.textContent = "REBUILD IT TOGETHER"; timerState.textContent = "LIVE";
}
function startRound() { if (phase === "showing") return; sequence.push(Math.floor(Math.random() * tiles.length)); renderLadder(); roundLabel.textContent = String(round).padStart(2, "0"); start.disabled = true; start.textContent = "ROUND ACTIVE"; playSequence(); }
function choose(index) {
  if (phase !== "playing") return;
  buttons[index].classList.add("pressed"); setTimeout(() => buttons[index].classList.remove("pressed"), 180);
  if (index !== sequence[input.length]) { clearInterval(interval); phase = "ready"; setBoardLocked(false); status.textContent = "PATTERN BROKEN — TRY THIS ROUND AGAIN"; timerState.textContent = "RESET"; start.disabled = false; start.textContent = "RETRY ROUND"; input = []; showStrip(); return; }
  input.push(index); showStrip();
  if (input.length === sequence.length) {
    clearInterval(interval); const elapsed = performance.now() - startedAt; timer.textContent = format(elapsed); bestTime = bestTime === null ? elapsed : Math.min(bestTime, elapsed); best.textContent = format(bestTime); phase = "ready"; setBoardLocked(false); status.textContent = "ROUND COMPLETE — TEAM MEMORY LEVELLED UP"; timerState.textContent = "COMPLETE"; round++; start.disabled = false; start.textContent = "NEXT ROUND"; renderLadder();
  }
}
document.querySelectorAll(".size-button").forEach(button => button.addEventListener("click", () => { if (phase !== "ready") return; teamSize = Number(button.dataset.size); document.querySelectorAll(".size-button").forEach(b => b.classList.toggle("active", b === button)); renderTeam(); }));
start.addEventListener("click", startRound);
reset.addEventListener("click", () => { clearInterval(interval); sequence=[]; input=[]; round=1; phase="ready"; timer.textContent="00:00.0"; timerState.textContent="READY"; status.textContent="Choose your crew, then start."; start.textContent="START ROUND"; start.disabled=false; setBoardLocked(false); renderLadder(); showStrip(); roundLabel.textContent="01"; });
renderTeam(); renderLadder(); setBoardLocked(false);
