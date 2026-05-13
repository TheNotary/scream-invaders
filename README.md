# SCREAM INVADERS 👾🎤

**[PLAY NOW](https://ashleywolf.github.io/scream-invaders/scream-invaders.html)** (bring headphones or warn your coworkers)

A Space Invaders clone where your keyboard is useless and your dignity is optional. Your webcam is the controller. Your lungs are the weapon.

## How it works

- **Your face moves the ship.** Tilt your head left, ship goes left. No hands required.
- **Your voice fires.** Sing Do, Re, Mi, Fa, Sol, La, or Ti to fire. A serene C drone plays as your reference pitch.
- **Two firing modes.** Press M to toggle:
  - **Pitch Mode** — the game detects the pitch you're singing and maps it to solfège notes. A target note is shown on screen.
  - **Falsetto Mode** — uses speech recognition to detect solfège syllables you speak/sing aloud.
- **On-screen feedback.** When you fire successfully, the solfège word you sang appears on screen along with your detected pitch.
- **Voice commands work too.** Say "LEFT" or "RIGHT" out loud. The aliens don't care about your feelings.
- **Headphones recommended** to prevent the reference drone from feeding back into your microphone.

By wave 5 you'll be standing up. By wave 7 someone will come check on you.

This is working as intended.

## What's under the hood

37KB. One HTML file. No build step. No npm install. No server required.

- [Three.js](https://threejs.org/) for 3D rendering
- [TensorFlow.js + BlazeFace](https://github.com/nicolo-ribaudo/face-mesh) for face tracking
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) for microphone volume, pitch detection, and reference drone
- [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API) for voice commands and solfège recognition

## Run locally

```bash
python3 -m http.server 8000
open http://localhost:8000/scream-invaders.html
```

Camera and mic need HTTPS or localhost.

## Lineage

This repo is a fork of [@leereilly's 3dpingpong](https://github.com/leereilly/3dpingpong) (itself a fork of [@martinwoodward's 3dbreakout](https://github.com/martinwoodward/3dbreakout)). Same question, different answer: what if the controller is your body?

## License

MIT
