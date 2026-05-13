#!/usr/bin/env python3
"""Generate WAV sound effects for Scream Invaders."""
import struct
import wave
import math
import random
import os

RATE = 44100
OUT_DIR = os.path.join(os.path.dirname(__file__), "assets")


def write_wav(filename, samples, rate=RATE):
    path = os.path.join(OUT_DIR, filename)
    with wave.open(path, "w") as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(rate)
        data = b"".join(struct.pack("<h", max(-32767, min(32767, int(s)))) for s in samples)
        f.writeframes(data)
    print(f"  wrote {path} ({len(samples)} samples, {len(samples)/rate:.3f}s)")


def envelope(t, attack, sustain, release, total):
    if t < attack:
        return t / attack
    elif t < attack + sustain:
        return 1.0
    elif t < total:
        return max(0, 1.0 - (t - attack - sustain) / release)
    return 0.0


def player_shot():
    """Short high-pitched laser blip."""
    dur = 0.08
    n = int(RATE * dur)
    samples = []
    for i in range(n):
        t = i / RATE
        freq = 1200 - 800 * (t / dur)  # sweep down from 1200 to 400
        env = envelope(t, 0.005, 0.02, 0.055, dur)
        val = math.sin(2 * math.pi * freq * t) * 0.5
        val += math.sin(2 * math.pi * freq * 2 * t) * 0.2  # harmonic
        samples.append(val * env * 24000)
    write_wav("player-shot.wav", samples)


def player_triple():
    """Rapid triple blip — three quick pips."""
    pip_dur = 0.04
    gap = 0.025
    total_dur = pip_dur * 3 + gap * 2
    n = int(RATE * total_dur)
    samples = []
    for i in range(n):
        t = i / RATE
        pip_idx = -1
        for p in range(3):
            start = p * (pip_dur + gap)
            if start <= t < start + pip_dur:
                pip_idx = p
                break
        if pip_idx >= 0:
            lt = t - pip_idx * (pip_dur + gap)
            freq = 1000 + pip_idx * 200  # each pip slightly higher
            env = envelope(lt, 0.003, 0.01, 0.027, pip_dur)
            val = math.sin(2 * math.pi * freq * lt) * 0.5
            val += (random.random() * 2 - 1) * 0.05  # tiny noise
            samples.append(val * env * 22000)
        else:
            samples.append(0)
    write_wav("player-triple.wav", samples)


def player_beam():
    """Sustained energy beam sweep."""
    dur = 0.25
    n = int(RATE * dur)
    samples = []
    for i in range(n):
        t = i / RATE
        freq = 300 + 600 * math.sin(math.pi * t / dur)  # arc up then down
        env = envelope(t, 0.01, 0.15, 0.09, dur)
        val = 0
        # sawtooth
        phase = (freq * t) % 1.0
        val += (2 * phase - 1) * 0.4
        # sub bass
        val += math.sin(2 * math.pi * 80 * t) * 0.2
        # noise texture
        val += (random.random() * 2 - 1) * 0.08
        samples.append(val * env * 22000)
    write_wav("player-beam.wav", samples)


def enemy_shot():
    """Lower-pitched enemy weapon sound — distinct from player."""
    dur = 0.12
    n = int(RATE * dur)
    samples = []
    for i in range(n):
        t = i / RATE
        freq = 200 + 300 * (t / dur)  # sweep UP (opposite of player)
        env = envelope(t, 0.005, 0.04, 0.075, dur)
        # square-ish wave
        phase = (freq * t) % 1.0
        val = 0.4 if phase < 0.5 else -0.4
        val += math.sin(2 * math.pi * freq * 0.5 * t) * 0.15
        samples.append(val * env * 20000)
    write_wav("enemy-shot.wav", samples)


def explosion():
    """Invader destroyed — short noise burst with pitch decay."""
    dur = 0.18
    n = int(RATE * dur)
    samples = []
    for i in range(n):
        t = i / RATE
        env = envelope(t, 0.002, 0.03, 0.148, dur)
        # filtered noise + low rumble
        noise = random.random() * 2 - 1
        rumble = math.sin(2 * math.pi * 60 * t) * 0.3
        # simple low-pass approximation via averaging
        val = noise * 0.6 + rumble
        samples.append(val * env * 22000)
    # apply simple smoothing for a more bass-heavy feel
    smoothed = [samples[0]]
    for i in range(1, len(samples)):
        smoothed.append(samples[i] * 0.4 + smoothed[i - 1] * 0.6)
    write_wav("explosion.wav", smoothed)


def ship_explosion():
    """Player ship hit — bigger, longer explosion with low rumble."""
    dur = 0.35
    n = int(RATE * dur)
    samples = []
    for i in range(n):
        t = i / RATE
        env = envelope(t, 0.003, 0.06, 0.287, dur)
        noise = random.random() * 2 - 1
        rumble = math.sin(2 * math.pi * 40 * t) * 0.4
        rumble2 = math.sin(2 * math.pi * 70 * t) * 0.2
        crackle = math.sin(2 * math.pi * (200 - 150 * t / dur) * t) * 0.15
        val = noise * 0.5 + rumble + rumble2 + crackle
        samples.append(val * env * 26000)
    smoothed = [samples[0]]
    for i in range(1, len(samples)):
        smoothed.append(samples[i] * 0.35 + smoothed[i - 1] * 0.65)
    write_wav("ship-explosion.wav", smoothed)


if __name__ == "__main__":
    os.makedirs(OUT_DIR, exist_ok=True)
    print("Generating sound effects...")
    player_shot()
    player_triple()
    player_beam()
    enemy_shot()
    explosion()
    ship_explosion()
    print("Done!")
