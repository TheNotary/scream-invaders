// ── Sound Input Module ──
// Microphone input, pitch detection, volume analysis, and speech recognition.
// All game state mutations are handled via callbacks passed to initVoiceCommands().

// ── Module-private state ──
let audioCtx = null;
let analyser = null;
let audioData = null;
let timeDomainData = null;
let voiceActive = false;

// ── Exported constants ──
export const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
export const SOLFEGE_MAP = { 'C':'Do','D':'Re','E':'Mi','F':'Fa','G':'Sol','A':'La','B':'Ti' };
export const SOLFEGE_NOTES = ['Do','Re','Mi','Fa','Sol','La','Ti'];

// ── Audio context setup ──
export function setupAudio(stream) {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const source = audioCtx.createMediaStreamSource(stream);
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.3;
  source.connect(analyser);
  audioData = new Uint8Array(analyser.frequencyBinCount);
  timeDomainData = new Float32Array(analyser.fftSize);
  return audioCtx;
}

export function getAudioContext() {
  return audioCtx;
}

// ── Volume detection ──
export function getVolume() {
  if (!analyser) return 0;
  analyser.getByteFrequencyData(audioData);
  let sum = 0;
  for (let i = 0; i < audioData.length; i++) sum += audioData[i];
  return (sum / audioData.length) / 255;
}

// ── Pitch detection (autocorrelation) ──
export function detectPitch() {
  if (!analyser || !timeDomainData) return null;
  analyser.getFloatTimeDomainData(timeDomainData);
  const buf = timeDomainData;
  const n = buf.length;

  // RMS gate — ignore silence / quiet noise
  let rms = 0;
  for (let i = 0; i < n; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / n);
  if (rms < 0.01) return null;

  // Autocorrelation
  const sampleRate = audioCtx.sampleRate;
  // Lag range corresponding to 80–1000 Hz
  const minLag = Math.floor(sampleRate / 1000); // ~1000 Hz ceiling
  const maxLag = Math.floor(sampleRate / 80);   // ~80 Hz floor

  let bestCorr = 0;
  let bestLag = -1;

  for (let lag = minLag; lag <= maxLag && lag < n; lag++) {
    let corr = 0;
    for (let i = 0; i < n - lag; i++) {
      corr += buf[i] * buf[i + lag];
    }
    if (corr > bestCorr) {
      bestCorr = corr;
      bestLag = lag;
    }
  }

  if (bestLag < 1) return null;

  // Require correlation to be reasonably strong relative to zero-lag (energy)
  let zeroCorr = 0;
  for (let i = 0; i < n; i++) zeroCorr += buf[i] * buf[i];
  if (bestCorr / zeroCorr < 0.3) return null;

  // Parabolic interpolation around peak for sub-sample accuracy
  const prev = autocorrAt(buf, n, bestLag - 1);
  const curr = bestCorr;
  const next = autocorrAt(buf, n, bestLag + 1);
  const shift = (prev - next) / (2 * (prev - 2 * curr + next));
  const refinedLag = bestLag + (isFinite(shift) ? shift : 0);

  return sampleRate / refinedLag;
}

export function autocorrAt(buf, n, lag) {
  if (lag < 0 || lag >= n) return 0;
  let corr = 0;
  for (let i = 0; i < n - lag; i++) corr += buf[i] * buf[i + lag];
  return corr;
}

// ── Frequency to solfège mapping ──
export function frequencyToSolfege(freq) {
  if (!freq || freq < 60 || freq > 1100) return null;
  // Semitones from A4 (440 Hz)
  const semitones = 12 * Math.log2(freq / 440);
  const rounded = Math.round(semitones);
  const cents = (semitones - rounded) * 100;
  if (Math.abs(cents) > 50) return null;

  // Note index (A = 9 in our NOTE_NAMES array where C = 0)
  let noteIndex = ((rounded % 12) + 12 + 9) % 12; // +9 because A is index 9 from C
  const noteName = NOTE_NAMES[noteIndex];

  // Only accept natural notes (no sharps/flats)
  if (noteName.includes('#')) return null;

  const octave = Math.floor((rounded + 9) / 12) + 4; // A4 = octave 4
  const solfege = SOLFEGE_MAP[noteName];

  return {
    solfege: solfege,
    note: noteName + octave,
    freq: freq,
    cents: Math.round(cents)
  };
}

// ── Voice commands (speech recognition) ──
export function initVoiceCommands(callbacks) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.warn('SpeechRecognition API not available');
    return;
  }

  // Solfège syllable → canonical name mapping
  const solfegeWords = {
    'do':'Do','doe':'Do','doh':'Do',
    're':'Re','ray':'Re',
    'mi':'Mi','me':'Mi','mee':'Mi',
    'fa':'Fa','fah':'Fa',
    'sol':'Sol','so':'Sol','sole':'Sol',
    'la':'La','lah':'La',
    'ti':'Ti','tee':'Ti','tea':'Ti'
  };

  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';
  recognition.onresult = function(event) {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript.toLowerCase().trim();
      // Movement commands — work in both modes
      if (transcript.includes('left')) {
        if (callbacks.onMoveLeft) callbacks.onMoveLeft();
      } else if (transcript.includes('right')) {
        if (callbacks.onMoveRight) callbacks.onMoveRight();
      }
      // Solfège firing — delegated to callback
      const words = transcript.split(/\s+/);
      for (const word of words) {
        const canonical = solfegeWords[word];
        if (canonical) {
          if (callbacks.onSolfegeDetected) callbacks.onSolfegeDetected(canonical);
          break; // one fire per recognition event
        }
      }
    }
  };
  recognition.onend = function() {
    try { recognition.start(); } catch(e) { /* already running */ }
  };
  recognition.onerror = function(e) {
    if (e.error === 'network') {
      console.warn('Speech recognition requires internet (uses cloud service)');
      voiceActive = false;
      if (callbacks.onVoiceStatusChange) callbacks.onVoiceStatusChange(false);
      if (callbacks.onFallbackToPitch) callbacks.onFallbackToPitch();
    } else if (e.error !== 'no-speech' && e.error !== 'aborted') {
      console.warn('Speech recognition error:', e.error);
    }
  };
  try {
    recognition.start();
    voiceActive = true;
    if (callbacks.onVoiceStatusChange) callbacks.onVoiceStatusChange(true);
  } catch(e) {
    console.warn('Could not start speech recognition:', e);
  }
}

export function isVoiceActive() {
  return voiceActive;
}
