# SCREAM INVADERS 👾🎤

**[PLAY NOW](https://ashleywolf.github.io/scream-invaders/scream-invaders.html)** (bring headphones or warn your coworkers)

A Space Invaders clone where your keyboard is useless and your dignity is optional. Your webcam is the controller. Your lungs are the weapon.

## How it works

- **Your face moves the ship.** Tilt your head left, ship goes left. No hands required.
- **Your voice fires.** Quiet noise = single shot. Yell = triple burst. Full scream = screen-clearing beam that shakes the display.
- **Voice commands work too.** Say "LEFT" or "RIGHT" out loud. The aliens don't care about your feelings.

By wave 5 you'll be standing up. By wave 7 someone will come check on you.

This is working as intended.

## What's under the hood

37KB. One HTML file. No build step. No npm install. No server required.

- [Three.js](https://threejs.org/) for 3D rendering
- [TensorFlow.js + BlazeFace](https://github.com/nicolo-ribaudo/face-mesh) for face tracking
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) for microphone volume
- [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API) for voice commands

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
