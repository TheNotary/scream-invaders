import { describe, it, expect } from 'vitest';
import {
  frequencyToSolfege,
  autocorrAt,
  NOTE_NAMES,
  SOLFEGE_MAP,
  SOLFEGE_NOTES,
} from '../sound_input.js';

describe('frequencyToSolfege', () => {
  it('maps 261.63 Hz to Do/C', () => {
    const result = frequencyToSolfege(261.63);
    expect(result).not.toBeNull();
    expect(result.solfege).toBe('Do');
    expect(result.note).toMatch(/^C\d$/);
  });

  it('maps 440 Hz to La/A', () => {
    const result = frequencyToSolfege(440);
    expect(result).not.toBeNull();
    expect(result.solfege).toBe('La');
    expect(result.note).toMatch(/^A\d$/);
  });

  it('maps 329.63 Hz to Mi/E', () => {
    const result = frequencyToSolfege(329.63);
    expect(result).not.toBeNull();
    expect(result.solfege).toBe('Mi');
    expect(result.note).toMatch(/^E\d$/);
  });

  it('maps 349.23 Hz to Fa/F', () => {
    const result = frequencyToSolfege(349.23);
    expect(result).not.toBeNull();
    expect(result.solfege).toBe('Fa');
    expect(result.note).toMatch(/^F\d$/);
  });

  it('maps 392 Hz to Sol/G', () => {
    const result = frequencyToSolfege(392);
    expect(result).not.toBeNull();
    expect(result.solfege).toBe('Sol');
    expect(result.note).toMatch(/^G\d$/);
  });

  it('maps 293.66 Hz to Re/D', () => {
    const result = frequencyToSolfege(293.66);
    expect(result).not.toBeNull();
    expect(result.solfege).toBe('Re');
    expect(result.note).toMatch(/^D\d$/);
  });

  it('maps 493.88 Hz to Ti/B', () => {
    const result = frequencyToSolfege(493.88);
    expect(result).not.toBeNull();
    expect(result.solfege).toBe('Ti');
    expect(result.note).toMatch(/^B\d$/);
  });

  it('returns null for frequency below 60 Hz', () => {
    expect(frequencyToSolfege(50)).toBeNull();
  });

  it('returns null for frequency above 1100 Hz', () => {
    expect(frequencyToSolfege(1200)).toBeNull();
  });

  it('returns null for sharp notes (C# at 277.18 Hz)', () => {
    expect(frequencyToSolfege(277.18)).toBeNull();
  });

  it('returns null for sharp notes (A# at 466.16 Hz)', () => {
    expect(frequencyToSolfege(466.16)).toBeNull();
  });

  it('returns null for null input', () => {
    expect(frequencyToSolfege(null)).toBeNull();
  });

  it('returns null for 0', () => {
    expect(frequencyToSolfege(0)).toBeNull();
  });

  it('returns null for negative frequency', () => {
    expect(frequencyToSolfege(-100)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(frequencyToSolfege(undefined)).toBeNull();
  });

  it('includes cents deviation in result', () => {
    const result = frequencyToSolfege(440);
    expect(result).toHaveProperty('cents');
    expect(typeof result.cents).toBe('number');
  });

  it('includes raw frequency in result', () => {
    const result = frequencyToSolfege(440);
    expect(result.freq).toBe(440);
  });
});

describe('autocorrAt', () => {
  const buf = new Float32Array([1, 0, -1, 0, 1]);
  const n = buf.length;

  it('computes sum of squares at lag 0', () => {
    // lag=0: 1*1 + 0*0 + (-1)*(-1) + 0*0 + 1*1 = 3
    expect(autocorrAt(buf, n, 0)).toBe(3);
  });

  it('computes correlation at lag 2', () => {
    // lag=2: 1*(-1) + 0*0 + (-1)*1 = -2
    expect(autocorrAt(buf, n, 2)).toBe(-2);
  });

  it('computes correlation at lag 1', () => {
    // lag=1: 1*0 + 0*(-1) + (-1)*0 + 0*1 = 0
    expect(autocorrAt(buf, n, 1)).toBe(0);
  });

  it('returns 0 for out-of-bounds lag (>= n)', () => {
    expect(autocorrAt(buf, n, 5)).toBe(0);
    expect(autocorrAt(buf, n, 10)).toBe(0);
  });

  it('returns 0 for negative lag', () => {
    expect(autocorrAt(buf, n, -1)).toBe(0);
    expect(autocorrAt(buf, n, -10)).toBe(0);
  });
});

describe('exported constants', () => {
  it('NOTE_NAMES has 12 entries', () => {
    expect(NOTE_NAMES).toHaveLength(12);
  });

  it('NOTE_NAMES starts with C and ends with B', () => {
    expect(NOTE_NAMES[0]).toBe('C');
    expect(NOTE_NAMES[11]).toBe('B');
  });

  it('SOLFEGE_MAP maps all natural notes correctly', () => {
    expect(SOLFEGE_MAP).toEqual({
      C: 'Do', D: 'Re', E: 'Mi', F: 'Fa', G: 'Sol', A: 'La', B: 'Ti',
    });
  });

  it('SOLFEGE_NOTES has 7 entries in order', () => {
    expect(SOLFEGE_NOTES).toEqual(['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Ti']);
  });
});
