# GitHub Pong 3D 🏓 + Scream Invaders 👾

Two webcam-controlled games, zero dependencies to install.

## Games

### [Scream Invaders](scream-invaders.html) 👾🎤

A Space Invaders clone where your keyboard is useless and your dignity is optional.

- **Webcam** tracks your face -- tilt your head to move
- **Microphone** controls your weapon -- quiet noise = single shot, yell = triple burst, full scream = screen-clearing beam
- **Voice commands** -- say "LEFT" or "RIGHT" out loud

By wave 5 you'll be standing up. By wave 7 someone will come check on you. This is working as intended.

**[Play Scream Invaders](https://ashleywolf.github.io/3dpingpong/scream-invaders.html)**

### [GitHub Pong 3D](index.html) 🏓

A 3D pong game themed after the GitHub contribution graph, with webcam eyebrow-tracking controls.

- **Raise your eyebrows** to move your paddle up
- **2-Player Mode** -- two faces detected = two human players
- **AI Opponent** -- one face = you vs. computer
- **Head-coupled parallax** -- 3D camera adjusts based on your head position

**[Play GitHub Pong 3D](https://ashleywolf.github.io/3dpingpong/)**

## Running Locally

```bash
python3 -m http.server 8000
open http://localhost:8000
```

Camera and mic need HTTPS or localhost.

## Lineage

[@martinwoodward's 3dbreakout](https://github.com/martinwoodward/3dbreakout) begat [@leereilly's 3dpingpong](https://github.com/leereilly/3dpingpong) begat [@ashleywolf's scream-invaders](https://github.com/ashleywolf/scream-invaders). Each one asks: what if the controller is your body?

## Tech

- [Three.js](https://threejs.org/) -- 3D rendering
- [TensorFlow.js + BlazeFace](https://github.com/nicolo-ribaudo/face-mesh) / [MediaPipe](https://developers.google.com/mediapipe) -- face tracking
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) -- microphone volume analysis
- [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API) -- voice commands
- Vanilla HTML/CSS/JS -- no build step
