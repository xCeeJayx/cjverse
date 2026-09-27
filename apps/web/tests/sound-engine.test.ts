import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SoundEngine, soundEngine } from '../src/lib/sound-engine';

describe('Web Audio Sound Effects Engine', () => {
  let mockStorage: any;

  beforeEach(() => {
    const store: Record<string, string> = {};
    mockStorage = {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, val: string) => {
        store[key] = val;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        for (const k in store) delete store[k];
      },
    };

    vi.stubGlobal('localStorage', mockStorage);
    vi.stubGlobal('window', {
      localStorage: mockStorage,
    });
  });

  it('exposes a singleton SoundEngine instance', () => {
    expect(soundEngine).toBeInstanceOf(SoundEngine);
    expect(SoundEngine.getInstance()).toBe(soundEngine);
  });

  it('manages mute state and persists to localStorage', () => {
    soundEngine.setMuted(false);
    expect(soundEngine.isMuted()).toBe(false);

    const listener = vi.fn();
    const unsubscribe = soundEngine.subscribe(listener);

    const toggled = soundEngine.toggleMute();
    expect(toggled).toBe(true);
    expect(soundEngine.isMuted()).toBe(true);
    expect(mockStorage.getItem('cjverse_audio_muted')).toBe('true');
    expect(listener).toHaveBeenCalledWith(true);

    const toggledBack = soundEngine.toggleMute();
    expect(toggledBack).toBe(false);
    expect(soundEngine.isMuted()).toBe(false);
    expect(mockStorage.getItem('cjverse_audio_muted')).toBe('false');
    expect(listener).toHaveBeenCalledWith(false);

    unsubscribe();
  });

  it('safely handles audio synthesis methods when AudioContext is mocked or unmuted', () => {
    class MockAudioContext {
      state = 'running';
      currentTime = 0;
      sampleRate = 44100;
      destination = {};

      createGain() {
        return {
          gain: {
            setValueAtTime: vi.fn(),
            linearRampToValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn(),
            cancelScheduledValues: vi.fn(),
          },
          connect: vi.fn(),
        };
      }

      createOscillator() {
        return {
          type: 'sine',
          frequency: {
            setValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn(),
          },
          connect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
        };
      }

      createBiquadFilter() {
        return {
          type: 'lowpass',
          frequency: {
            setValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn(),
          },
          Q: {
            setValueAtTime: vi.fn(),
          },
          connect: vi.fn(),
        };
      }

      createBuffer(channels: number, length: number, sampleRate: number) {
        return {
          getChannelData: () => new Float32Array(length),
        };
      }

      createBufferSource() {
        return {
          connect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
        };
      }

      resume = vi.fn().mockResolvedValue(undefined);
    }

    vi.stubGlobal('AudioContext', MockAudioContext);
    vi.stubGlobal('window', {
      AudioContext: MockAudioContext,
      localStorage: mockStorage,
    });

    soundEngine.setMuted(false);

    expect(() => soundEngine.playAttack()).not.toThrow();
    expect(() => soundEngine.playBurst()).not.toThrow();
    expect(() => soundEngine.playUltimate()).not.toThrow();
    expect(() => soundEngine.playTimerTick()).not.toThrow();
    expect(() => soundEngine.playVictory()).not.toThrow();
    expect(() => soundEngine.playDefeat()).not.toThrow();
  });

  it('suppresses audio synthesis when muted', () => {
    soundEngine.setMuted(true);
    expect(soundEngine.isMuted()).toBe(true);

    expect(() => soundEngine.playAttack()).not.toThrow();
    expect(() => soundEngine.playBurst()).not.toThrow();
    expect(() => soundEngine.playUltimate()).not.toThrow();
    expect(() => soundEngine.playTimerTick()).not.toThrow();
    expect(() => soundEngine.playVictory()).not.toThrow();
    expect(() => soundEngine.playDefeat()).not.toThrow();
  });
});
