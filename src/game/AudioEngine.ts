export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private humOsc: OscillatorNode | null = null;
  private humSubOsc: OscillatorNode | null = null;
  private humFilter: BiquadFilterNode | null = null;
  private humGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private muted = false;
  private initialized = false;

  public unlock(): void {
    if (this.initialized) {
      if (this.ctx && this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return;
    }

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    try {
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.48;
      this.masterGain.connect(this.ctx.destination);

      // Pre-generate 1 second of white noise for dash/impact textures
      const sampleRate = this.ctx.sampleRate;
      this.noiseBuffer = this.ctx.createBuffer(1, sampleRate, sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < sampleRate; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      // Ambient gravity hum (muted when idle on menus)
      this.humOsc = this.ctx.createOscillator();
      this.humSubOsc = this.ctx.createOscillator();
      this.humFilter = this.ctx.createBiquadFilter();
      this.humGain = this.ctx.createGain();

      this.humOsc.type = 'sawtooth';
      this.humOsc.frequency.value = 54;
      this.humSubOsc.type = 'sine';
      this.humSubOsc.frequency.value = 36;

      this.humFilter.type = 'lowpass';
      this.humFilter.frequency.value = 110;
      this.humFilter.Q.value = 1.6;

      this.humGain.gain.value = 0;

      this.humOsc.connect(this.humFilter);
      this.humSubOsc.connect(this.humFilter);
      this.humFilter.connect(this.humGain);
      this.humGain.connect(this.masterGain);

      this.humOsc.start();
      this.humSubOsc.start();

      this.initialized = true;
    } catch {
      // AudioContext unavailable or blocked
    }
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.48, this.ctx.currentTime, 0.03);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public updateAmbient(active: boolean, tier: number, speedRatio: number): void {
    if (!this.ctx || !this.humGain || !this.humOsc || !this.humSubOsc || !this.humFilter) return;
    const now = this.ctx.currentTime;
    if (!active || this.muted) {
      this.humGain.gain.setTargetAtTime(0, now, 0.12);
      return;
    }

    const baseFreq = Math.max(34, 62 - tier * 4);
    this.humOsc.frequency.setTargetAtTime(baseFreq + speedRatio * 12, now, 0.15);
    this.humSubOsc.frequency.setTargetAtTime(baseFreq * 0.66, now, 0.15);
    this.humFilter.frequency.setTargetAtTime(90 + tier * 20 + speedRatio * 60, now, 0.15);
    this.humGain.gain.setTargetAtTime(0.045 + Math.min(0.05, speedRatio * 0.035), now, 0.12);
  }

  public playSwallow(tier: number, combo: number): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;

    // 1. Bubble/absorb upward chirp with dynamic pitch rising per combo streak
    const streakPitchMult = Math.pow(1.045, Math.min(combo - 1, 16));
    const baseFreq = Math.max(150, 320 - tier * 26) * streakPitchMult;
    const peakFreq = baseFreq * 1.95;

    const bubbleOsc = this.ctx.createOscillator();
    const bubbleFilter = this.ctx.createBiquadFilter();
    const bubbleGain = this.ctx.createGain();

    bubbleOsc.type = 'sine';
    bubbleOsc.frequency.setValueAtTime(baseFreq, now);
    bubbleOsc.frequency.exponentialRampToValueAtTime(peakFreq, now + 0.085);

    bubbleFilter.type = 'bandpass';
    bubbleFilter.frequency.setValueAtTime(peakFreq, now);
    bubbleFilter.Q.value = 2.4;

    bubbleGain.gain.setValueAtTime(0.01, now);
    bubbleGain.gain.linearRampToValueAtTime(0.26, now + 0.015);
    bubbleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

    bubbleOsc.connect(bubbleFilter);
    bubbleFilter.connect(bubbleGain);
    bubbleGain.connect(this.masterGain);
    bubbleOsc.start(now);
    bubbleOsc.stop(now + 0.12);

    // 2. Soft sub-absorb body
    const bodyOsc = this.ctx.createOscillator();
    const bodyGain = this.ctx.createGain();
    bodyOsc.type = tier >= 4 ? 'triangle' : 'sine';
    bodyOsc.frequency.setValueAtTime(baseFreq * 0.72, now);
    bodyOsc.frequency.exponentialRampToValueAtTime(Math.max(55, baseFreq * 0.36), now + 0.11);
    bodyGain.gain.setValueAtTime(0.14, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    bodyOsc.connect(bodyGain);
    bodyGain.connect(this.masterGain);
    bodyOsc.start(now);
    bodyOsc.stop(now + 0.13);

    if (tier >= 4) {
      this.playHeavyThud(0.24);
    }
  }

  public playFeverStart(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const t = now + idx * 0.045;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.2, t + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }

  public playComboCue(combo: number): void {
    if (!this.ctx || !this.masterGain || this.muted || combo < 2) return;
    const now = this.ctx.currentTime;
    const pentatonic = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66];
    const freq = pentatonic[Math.min(combo - 2, pentatonic.length - 1)];

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.06, now + 0.12);

    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  public playTierUnlock(tier: number): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const root = 261.63 * Math.pow(1.12246, Math.min(tier, 6));
    const ratios = [1, 1.25, 1.5, 2];

    ratios.forEach((ratio, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const t = now + idx * 0.055;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(root * ratio, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.18, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.34);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.36);
    });
  }

  public playDash(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;

    if (this.noiseBuffer) {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(320, now);
      filter.frequency.exponentialRampToValueAtTime(1650, now + 0.18);
      filter.Q.value = 1.4;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      noise.start(now);
      noise.stop(now + 0.25);
    }

    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(170, now);
    sub.frequency.exponentialRampToValueAtTime(52, now + 0.18);
    subGain.gain.setValueAtTime(0.24, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    sub.connect(subGain);
    subGain.connect(this.masterGain);
    sub.start(now);
    sub.stop(now + 0.21);
  }

  public playHeavyThud(intensity = 0.35): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(98, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.26);

    gain.gain.setValueAtTime(intensity, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.29);
  }

  public playBump(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(86, now);
    osc.frequency.exponentialRampToValueAtTime(52, now + 0.06);

    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  public playTimerTick(urgent: boolean): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(urgent ? 980 : 740, now);
    gain.gain.setValueAtTime(urgent ? 0.14 : 0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  public playRoundEnd(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      if (!this.ctx || !this.masterGain) return;
      const t = now + i * 0.08;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.46);
    });
  }

  public destroy(): void {
    try {
      this.humOsc?.stop();
      this.humSubOsc?.stop();
      if (this.ctx && this.ctx.state !== 'closed') {
        void this.ctx.close();
      }
    } catch {
      // Ignore cleanup errors
    }
    this.ctx = null;
    this.initialized = false;
  }
}
