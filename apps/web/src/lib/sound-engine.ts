/**
 * Procedural Web Audio API Sound Effects Engine for CJVerse Skirmish Arena.
 * Generates dynamic, responsive combat SFX completely procedurally without external assets.
 */

type MuteListener = (muted: boolean) => void;

export class SoundEngine {
  private static instance: SoundEngine | null = null;
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private muted: boolean = false;
  private listeners: Set<MuteListener> = new Set();
  private isUnlocked: boolean = false;

  private constructor() {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('cjverse_audio_muted');
        this.muted = stored === 'true';
      } catch {
        this.muted = false;
      }
    }
  }

  public static getInstance(): SoundEngine {
    if (!SoundEngine.instance) {
      SoundEngine.instance = new SoundEngine();
    }
    return SoundEngine.instance;
  }

  /**
   * Lazily initializes and unlocks the AudioContext upon user gesture.
   */
  public ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;

      try {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.muted ? 0 : 0.35, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
      } catch (err) {
        console.warn('[SoundEngine] Failed to initialize AudioContext:', err);
        return null;
      }
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    this.isUnlocked = true;
    return this.ctx;
  }

  /**
   * Handles user-interaction unlock for browser autoplay policies.
   */
  public unlock(): void {
    this.ensureContext();
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : 0.35, this.ctx.currentTime);
    }

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('cjverse_audio_muted', String(this.muted));
      } catch {}
    }

    this.listeners.forEach((listener) => listener(this.muted));
  }

  public toggleMute(): boolean {
    this.ensureContext();
    this.setMuted(!this.muted);
    return this.muted;
  }

  public subscribe(listener: MuteListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Creates a white noise buffer.
   */
  private createNoiseBuffer(durationSeconds: number): AudioBuffer | null {
    const ctx = this.ensureContext();
    if (!ctx) return null;

    const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * durationSeconds));
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private lastActionSoundTime = 0;

  private checkActionThrottle(): boolean {
    const now = Date.now();
    if (now - this.lastActionSoundTime < 60) return true;
    this.lastActionSoundTime = now;
    return false;
  }

  /**
   * playAttack(): Sharp white noise burst + quick pitch drop for a crisp weapon strike/slash impact.
   */
  public playAttack(): void {
    if (this.muted) return;
    if (this.checkActionThrottle()) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;

    // 1. Sharp white noise slash impact
    const noiseBuffer = this.createNoiseBuffer(0.08);
    if (noiseBuffer) {
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2400, now);
      filter.Q.setValueAtTime(1.5, now);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.4, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.masterGain);

      noise.start(now);
      noise.stop(now + 0.08);
    }

    // 2. Pitch-drop strike body
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(380, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.1);

    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.5, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  /**
   * playBurst(): Dual-oscillator sine/triangle sweep with resonant filter for an elemental magic explosion.
   */
  public playBurst(): void {
    if (this.muted) return;
    if (this.checkActionThrottle()) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const duration = 0.35;

    // Resonant lowpass filter
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.setValueAtTime(5.0, now);
    filter.frequency.setValueAtTime(2200, now);
    filter.frequency.exponentialRampToValueAtTime(220, now + duration);

    const burstGain = ctx.createGain();
    burstGain.gain.setValueAtTime(0.01, now);
    burstGain.gain.linearRampToValueAtTime(0.6, now + 0.02);
    burstGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    // Osc 1: Sine descending sweep
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(540, now);
    osc1.frequency.exponentialRampToValueAtTime(110, now + duration);

    // Osc 2: Triangle sub harmonic
    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(280, now);
    osc2.frequency.exponentialRampToValueAtTime(70, now + duration);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(burstGain);
    burstGain.connect(this.masterGain);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + duration);
    osc2.stop(now + duration);

    // Crackle noise burst accent
    const noiseBuffer = this.createNoiseBuffer(0.12);
    if (noiseBuffer) {
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.2, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      noise.connect(noiseGain);
      noiseGain.connect(this.masterGain);
      noise.start(now);
      noise.stop(now + 0.12);
    }
  }

  /**
   * playUltimate(): Heavy sub-bass thud layered with a rising arpeggiated tri-tone crescendo.
   */
  public playUltimate(): void {
    if (this.muted) return;
    if (this.checkActionThrottle()) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;

    // 1. Heavy sub-bass thud
    const subOsc = ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(120, now);
    subOsc.frequency.exponentialRampToValueAtTime(32, now + 0.55);

    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.7, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

    subOsc.connect(subGain);
    subGain.connect(this.masterGain);
    subOsc.start(now);
    subOsc.stop(now + 0.55);

    // 2. Rising arpeggiated crescendo: F#3, C4, F#4, C5, F#5, A5
    const triToneFrequencies = [185.0, 261.63, 369.99, 523.25, 739.99, 880.0];
    const noteStep = 0.045;

    triToneFrequencies.forEach((freq, idx) => {
      const noteTime = now + idx * noteStep;
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, noteTime);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400 + idx * 300, noteTime);

      const noteGain = ctx.createGain();
      noteGain.gain.setValueAtTime(0.01, noteTime);
      noteGain.gain.linearRampToValueAtTime(0.3, noteTime + 0.015);
      noteGain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.35);

      osc.connect(filter);
      filter.connect(noteGain);
      noteGain.connect(this.masterGain!);

      osc.start(noteTime);
      osc.stop(noteTime + 0.35);
    });
  }

  /**
   * playTimerTick(): Crisp short high-frequency click (plays when timer <= 5 seconds).
   */
  public playTimerTick(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1480, now);
    osc.frequency.exponentialRampToValueAtTime(900, now + 0.035);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.035);
  }

  /**
   * playVictory(): Uplifting 3-chord major brass/synth fanfare.
   */
  public playVictory(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;

    // Chord 1: C Major (C4, E4, G4)
    this.playChord([261.63, 329.63, 392.0], now, 0.22, 0.35);

    // Chord 2: F Major (F4, A4, C5)
    this.playChord([349.23, 440.0, 523.25], now + 0.24, 0.24, 0.4);

    // Chord 3: Grand C Major (G4, C5, E5, G5)
    this.playChord([392.0, 523.25, 659.25, 783.99], now + 0.5, 0.75, 0.5);
  }

  /**
   * playDefeat(): Descending minor arpeggio fade-out.
   */
  public playDefeat(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    // Descending notes: E4, C4, A3, F3, D3
    const notes = [329.63, 261.63, 220.0, 174.61, 146.83];
    const step = 0.14;

    notes.forEach((freq, idx) => {
      const noteTime = now + idx * step;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, noteTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.3, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.45);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(noteTime);
      osc.stop(noteTime + 0.45);
    });
  }

  /**
   * playPackTear(): Crunchy foil tear burst + resonant metallic sheen.
   */
  public playPackTear(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const bufferSize = ctx.sampleRate * 0.28;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(3200, now);
    filter.frequency.exponentialRampToValueAtTime(700, now + 0.25);
    filter.Q.setValueAtTime(4.0, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.4, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    whiteNoise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    whiteNoise.start(now);
    whiteNoise.stop(now + 0.28);

    // Resonant chime finish
    const chime = ctx.createOscillator();
    chime.type = 'sine';
    chime.frequency.setValueAtTime(880, now + 0.12);
    chime.frequency.exponentialRampToValueAtTime(1760, now + 0.35);

    const chimeGain = ctx.createGain();
    chimeGain.gain.setValueAtTime(0.15, now + 0.12);
    chimeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    chime.connect(chimeGain);
    chimeGain.connect(this.masterGain);
    chime.start(now + 0.12);
    chime.stop(now + 0.4);
  }

  /**
   * playCardFlip(): Smooth whoosh + tactile card snap.
   */
  public playCardFlip(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(1100, now + 0.05);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  /**
   * playRareReveal(): Shimmering arpeggio for Gold/Diamond card pull.
   */
  public playRareReveal(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const notes = [587.33, 739.99, 880.0, 1174.66, 1479.98]; // D5, F#5, A5, D6, F#6
    notes.forEach((freq, idx) => {
      const noteTime = now + idx * 0.055;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, noteTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.2, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.45);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(noteTime);
      osc.stop(noteTime + 0.45);
    });
  }

  private playChord(frequencies: number[], startTime: number, duration: number, volume: number): void {
    if (!this.ctx || !this.masterGain) return;

    frequencies.forEach((freq) => {
      const osc = this.ctx!.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, startTime);

      const filter = this.ctx!.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2000, startTime);

      const gain = this.ctx!.createGain();
      gain.gain.setValueAtTime(0.01, startTime);
      gain.gain.linearRampToValueAtTime(volume / frequencies.length, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(startTime);
      osc.stop(startTime + duration);
    });
  }
}

export const soundEngine = SoundEngine.getInstance();
