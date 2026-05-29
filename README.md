# Pose Match Game

A fast-paced, browser-based party game where players race to physically match poses shown on screen. The app uses MediaPipe Pose Landmarker through the webcam when available and falls back to a demo scoring mode when camera/model access is unavailable.

## Gameplay

- A glowing target silhouette appears with a 3-second countdown.
- Players match the pose before time expires.
- MediaPipe detects 33 body landmarks and the scoring engine compares key joint angles against the target pose.
- Scores are awarded from 0-100 each round with feedback tiers: Perfect, Great, Good, and Miss.
- Matches run for 10 rounds with progressively harder poses.

## Modes

- **Solo Challenge**: beat your own total score.
- **Hot Seat Multiplayer**: add local players and pass the webcam between turns.
- **Party Showdown**: share the displayed room code and sync browser-local party scores through local storage events.

## Run locally

```bash
npm start
```

Then open <http://localhost:4173> in a browser. Webcam AI scoring requires a browser that supports `getUserMedia`, WebAssembly, and dynamic ES module imports from the MediaPipe CDN.

## Check JavaScript syntax

```bash
npm test
```
