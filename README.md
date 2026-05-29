# Wing Flappy

A browser-based Flappy Bird style game controlled with arm movement through Google MediaPipe Pose.

## Run locally

Install the local MediaPipe packages, then start the web server:

```powershell
npm install
npm start
```

Open `http://localhost:5173`.

The webcam control needs browser camera permission. Click **Play** and approve the browser prompt. After that, choose **Camera** or **Keyboard**.

In Camera mode, flap by moving both arms together like wings. For best results, step back far enough that your shoulders, elbows, and wrists are visible. Each mode gives you a 5-second countdown before the round starts. If the camera is unavailable, choose **Keyboard** to play with spacebar, click, or tap controls.

On game over in Camera mode, clap your hands to restart.

If an embedded or in-app browser blocks webcam access, open the same local URL in Chrome or Edge and allow camera access from the address bar.
