/**
 * Procedural Web Audio synthesizer for realistic Downhill MTB soundscapes
 */
class SoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private isInitialized: boolean = false;

  // Continuous sound nodes
  private tireNoiseNode: AudioBufferSourceNode | null = null;
  private tireGainNode: GainNode | null = null;
  private tireFilterNode: BiquadFilterNode | null = null;

  private windGainNode: GainNode | null = null;
  private windFilterNode: BiquadFilterNode | null = null;

  private freehubGainNode: GainNode | null = null;
  private freehubOscNode: OscillatorNode | null = null;

  private skidGainNode: GainNode | null = null;
  private skidFilterNode: BiquadFilterNode | null = null;

  init() {
    if (this.isInitialized) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.setupContinuousNodes();
      this.isInitialized = true;
    } catch {
      // Audio context might fail before user gesture; will resume on first click
    }
  }

  ensureContext() {
    if (!this.ctx) {
      this.init();
    } else if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  private setupContinuousNodes() {
    if (!this.ctx) return;

    // 1. Wind Rush Synth (Pink noise via buffer)
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      output[i] *= 0.11;
      b6 = white * 0.115926;
    }

    // Wind loop
    const windSource = this.ctx.createBufferSource();
    windSource.buffer = noiseBuffer;
    windSource.loop = true;
    this.windFilterNode = this.ctx.createBiquadFilter();
    this.windFilterNode.type = 'lowpass';
    this.windFilterNode.frequency.value = 350;
    this.windGainNode = this.ctx.createGain();
    this.windGainNode.gain.value = 0.001;
    windSource.connect(this.windFilterNode);
    this.windFilterNode.connect(this.windGainNode);
    this.windGainNode.connect(this.ctx.destination);
    windSource.start(0);

    // Tire rolling loop
    const tireSource = this.ctx.createBufferSource();
    tireSource.buffer = noiseBuffer;
    tireSource.loop = true;
    this.tireFilterNode = this.ctx.createBiquadFilter();
    this.tireFilterNode.type = 'bandpass';
    this.tireFilterNode.frequency.value = 450;
    this.tireFilterNode.Q.value = 2.5;
    this.tireGainNode = this.ctx.createGain();
    this.tireGainNode.gain.value = 0.001;
    tireSource.connect(this.tireFilterNode);
    this.tireFilterNode.connect(this.tireGainNode);
    this.tireGainNode.connect(this.ctx.destination);
    tireSource.start(0);

    // Skid & Gravel slide loop (organic low-mid gravel displacement)
    const skidSource = this.ctx.createBufferSource();
    skidSource.buffer = noiseBuffer;
    skidSource.loop = true;
    this.skidFilterNode = this.ctx.createBiquadFilter();
    // Warm Biquad lowpass filter (1400Hz cutoff) to remove piercing high frequencies
    this.skidFilterNode.type = 'lowpass';
    this.skidFilterNode.frequency.value = 1450;
    this.skidFilterNode.Q.value = 1.2;
    this.skidGainNode = this.ctx.createGain();
    this.skidGainNode.gain.value = 0.0001;
    skidSource.connect(this.skidFilterNode);
    this.skidFilterNode.connect(this.skidGainNode);
    this.skidGainNode.connect(this.ctx.destination);
    skidSource.start(0);

    // Freehub ratchet oscillator
    this.freehubOscNode = this.ctx.createOscillator();
    this.freehubOscNode.type = 'sawtooth';
    this.freehubOscNode.frequency.value = 85;
    this.freehubGainNode = this.ctx.createGain();
    this.freehubGainNode.gain.value = 0.0001;
    this.freehubOscNode.connect(this.freehubGainNode);
    this.freehubGainNode.connect(this.ctx.destination);
    this.freehubOscNode.start(0);
  }

  update(
    speedKmh: number,
    isGrounded: boolean,
    isPedaling: boolean,
    isBraking: boolean,
    isSkidding: boolean,
    suspensionMovement: number,
    surface: string = 'dirt',
    deceleration: number = 0
  ) {
    if (!this.ctx || this.isMuted) return;

    const t = this.ctx.currentTime;
    const speedRatio = Math.min(1.0, Math.max(0, speedKmh / 75));

    // Wind sound
    if (this.windGainNode && this.windFilterNode) {
      const targetGain = Math.pow(speedRatio, 1.8) * 0.35;
      const targetFreq = 200 + speedRatio * 1800;
      this.windGainNode.gain.setTargetAtTime(targetGain, t, 0.1);
      this.windFilterNode.frequency.setTargetAtTime(targetFreq, t, 0.1);
    }

    // Tire on dirt sound
    if (this.tireGainNode && this.tireFilterNode) {
      const groundedMultiplier = isGrounded ? 1.0 : 0.05;
      const targetGain = Math.pow(speedRatio, 0.9) * 0.4 * groundedMultiplier;
      const targetFreq = 250 + speedRatio * 700 + suspensionMovement * 300;
      this.tireGainNode.gain.setTargetAtTime(targetGain, t, 0.05);
      this.tireFilterNode.frequency.setTargetAtTime(targetFreq, t, 0.05);
    }

    // Skid / Drift / Loose gravel slide sound with Biquad lowpass filter (1200-1600Hz)
    if (this.skidGainNode && this.skidFilterNode) {
      const isLoose = surface === 'loose_gravel' || surface === 'dirt';
      const skidActive = isGrounded && (isSkidding || (isBraking && speedKmh > 8));
      const decelFactor = Math.min(1.0, Math.max(0.3, deceleration * 0.2));
      const skidIntensity = skidActive
        ? (isSkidding ? 0.32 : 0.18 * decelFactor) * Math.min(1.0, speedKmh / 22)
        : 0.0001;
      this.skidGainNode.gain.setTargetAtTime(skidIntensity, t, 0.04);
      if (skidActive) {
        // Cutoff strictly in the 1200Hz - 1650Hz range to eliminate harsh piercing frequencies
        const cutoff = isLoose ? (1150 + speedRatio * 380) : (1300 + speedRatio * 350);
        this.skidFilterNode.frequency.setTargetAtTime(cutoff, t, 0.04);
      }
    }

    // Freehub high-engagement rapid ratchet pawl buzz (coasting at speed)
    if (this.freehubGainNode && this.freehubOscNode) {
      const coasting = !isPedaling && speedKmh > 3.5;
      const targetGain = coasting ? Math.min(0.12, 0.03 + (speedKmh / 60) * 0.09) : 0.0001;
      const targetFreq = 120 + speedRatio * 620;
      this.freehubGainNode.gain.setTargetAtTime(targetGain, t, 0.04);
      this.freehubOscNode.frequency.setTargetAtTime(targetFreq, t, 0.04);
    }
  }

  // Play suspension whoosh / rebound hiss
  playSuspensionHiss(intensity: number = 1.0) {
    if (!this.ctx || this.isMuted) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2200, t);
      filter.frequency.exponentialRampToValueAtTime(800, t + 0.15);

      gain.gain.setValueAtTime(0.12 * intensity, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, t);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.16);
    } catch {
      // Audio node cleanup
    }
  }

  // Play landing impact thump
  playLandingThump(impactVelocity: number) {
    if (!this.ctx || this.isMuted) return;
    try {
      const t = this.ctx.currentTime;
      const intensity = Math.min(1.0, Math.max(0.2, impactVelocity / 15));

      // Low frequency sub thump
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(110, t);
      osc.frequency.exponentialRampToValueAtTime(32, t + 0.25);

      gain.gain.setValueAtTime(0.45 * intensity, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.26);

      this.playSuspensionHiss(intensity);
    } catch {
      // Audio node cleanup
    }
  }

  // Play mechanical suspension bottom-out metallic clunk
  playBottomOut(intensity: number = 1.0) {
    if (!this.ctx || this.isMuted) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(260, t);
      osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, t);
      filter.frequency.exponentialRampToValueAtTime(150, t + 0.12);

      gain.gain.setValueAtTime(0.38 * Math.min(1.0, intensity), t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.15);
    } catch {
      // Audio node cleanup
    }
  }

  // Play realistic downhill chain slap against chainstay on technical chatter
  playChainSlap(intensity: number = 0.8) {
    if (!this.ctx || this.isMuted) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'square';
      osc.frequency.setValueAtTime(420, t);
      osc.frequency.exponentialRampToValueAtTime(90, t + 0.05);

      filter.type = 'highpass';
      filter.frequency.setValueAtTime(600, t);

      gain.gain.setValueAtTime(0.18 * Math.min(1.0, intensity), t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.07);
    } catch {
      // Cleanup
    }
  }

  // Play jump takeoff pop
  playJumpLaunch() {
    if (!this.ctx || this.isMuted) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, t);
      osc.frequency.exponentialRampToValueAtTime(340, t + 0.12);

      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.13);
    } catch {
      // Ignore
    }
  }

  // Play gear shift click
  playGearShift() {
    if (!this.ctx || this.isMuted) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(800, t);
      osc.frequency.setValueAtTime(1200, t + 0.02);

      gain.gain.setValueAtTime(0.1, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.06);
    } catch {
      // Ignore
    }
  }

  // Crash sound
  playCrash() {
    if (!this.ctx || this.isMuted) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(90, t);
      osc.frequency.linearRampToValueAtTime(30, t + 0.6);

      gain.gain.setValueAtTime(0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.62);
    } catch {
      // Ignore
    }
  }

  // Checkpoint chime
  // Play pump impulse whoosh
  playPumpSurge() {
    if (!this.ctx || this.isMuted) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(450, t);
      filter.frequency.exponentialRampToValueAtTime(1400, t + 0.12);

      gain.gain.setValueAtTime(0.24, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(85, t);
      osc.frequency.linearRampToValueAtTime(145, t + 0.18);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.23);
    } catch {
      // Ignore
    }
  }

  // Early advance warning cue: fires when rider is approaching a split/finish gate on blind terrain
  playSplitApproachCue() {
    if (!this.ctx || this.isMuted) return;
    try {
      const t = this.ctx.currentTime;
      // High-clarity electronic advance double-chime (880Hz -> 1174.6Hz)
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();
      const gain2 = this.ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, t);
      gain1.gain.setValueAtTime(0.18, t);
      gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1174.66, t + 0.07);
      gain2.gain.setValueAtTime(0.0, t);
      gain2.gain.setValueAtTime(0.22, t + 0.07);
      gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

      osc1.connect(gain1);
      gain1.connect(this.ctx.destination);
      osc2.connect(gain2);
      gain2.connect(this.ctx.destination);

      osc1.start(t);
      osc1.stop(t + 0.13);
      osc2.start(t + 0.07);
      osc2.stop(t + 0.23);
    } catch {
      // Ignore
    }
  }

  playCheckpoint() {
    if (!this.ctx || this.isMuted) return;
    try {
      const t = this.ctx.currentTime;
      [587.33, 880.00].forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t + idx * 0.08);

        gain.gain.setValueAtTime(0.2, t + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.08 + 0.35);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(t + idx * 0.08);
        osc.stop(t + idx * 0.08 + 0.36);
      });
    } catch {
      // Ignore
    }
  }

  // Play crisp ping & ricochet chime when striking loose rocks on trail
  playLooseRockStrike(intensity: number = 0.8) {
    if (!this.ctx || this.isMuted) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      // Sharp resonant mineral stone ping (1400-1900 Hz)
      osc.type = 'triangle';
      const startFreq = 1450 + Math.random() * 450;
      osc.frequency.setValueAtTime(startFreq, t);
      osc.frequency.exponentialRampToValueAtTime(800, t + 0.09);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(startFreq, t);
      filter.Q.setValueAtTime(4.0, t);

      gain.gain.setValueAtTime(0.28 * Math.min(1.0, intensity), t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.13);
    } catch {
      // Ignore
    }
  }

  // Play brittle pine cone woody crush/crunch under knobby tires
  playPineConeCrunch() {
    if (!this.ctx || this.isMuted) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      // Brittle woody snap
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(380 + Math.random() * 80, t);
      osc.frequency.exponentialRampToValueAtTime(90, t + 0.07);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2200, t);
      filter.frequency.exponentialRampToValueAtTime(300, t + 0.07);

      gain.gain.setValueAtTime(0.22, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.09);
    } catch {
      // Ignore
    }
  }

  // Play wet mud squelch & slurry tire spray
  playMudSquish(intensity: number = 0.6) {
    if (!this.ctx || this.isMuted) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      // Squelchy low-mid slurry resonance
      osc.type = 'sine';
      osc.frequency.setValueAtTime(160, t);
      osc.frequency.linearRampToValueAtTime(280, t + 0.06);
      osc.frequency.exponentialRampToValueAtTime(60, t + 0.18);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, t);
      filter.frequency.linearRampToValueAtTime(350, t + 0.18);

      gain.gain.setValueAtTime(0.25 * Math.min(1.0, intensity), t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.20);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.21);
    } catch {
      // Ignore
    }
  }

  // Play high-energy World Cup fan air horn blast
  playAirHorn() {
    if (!this.ctx || this.isMuted) return;
    try {
      const t = this.ctx.currentTime;
      // Authentic dual-tone stadium air horn (Bb4 + D5 with rich overtones)
      const freqs = [466.16, 587.33];
      freqs.forEach((f) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(f, t);
        osc.frequency.linearRampToValueAtTime(f * 1.015, t + 0.08);
        osc.frequency.linearRampToValueAtTime(f * 0.98, t + 0.45);

        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(f * 1.8, t);
        filter.Q.setValueAtTime(2.2, t);

        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.18, t + 0.03);
        gain.gain.setValueAtTime(0.18, t + 0.38);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.52);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(t);
        osc.stop(t + 0.53);
      });
    } catch {
      // Ignore
    }
  }

  // Play 4-piston disc brake metallic rotor friction hiss with Biquad lowpass filter and loose slide layer
  playBrakeRotorHiss(intensity: number = 0.5, surface: string = 'dirt') {
    if (!this.ctx || this.isMuted) return;
    try {
      const t = this.ctx.currentTime;
      const clampedIntensity = Math.min(1.0, Math.max(0.1, intensity));

      // 1. Warm metallic rotor pad friction with Biquad lowpass filter at 1500Hz
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const brakeFilter = this.ctx.createBiquadFilter();

      osc.type = 'triangle';
      // Pitch modulates with deceleration intensity (420Hz - 850Hz)
      osc.frequency.setValueAtTime(420 + clampedIntensity * 430, t);
      osc.frequency.exponentialRampToValueAtTime(260, t + 0.18);

      // Insert BiquadFilterNode between brake audio source and destination:
      // Set filter type to 'lowpass' and frequency.value to 1500 Hz to muffle harsh frequencies into a deeper rubbing sound
      brakeFilter.type = 'lowpass';
      brakeFilter.frequency.value = 1500;
      brakeFilter.Q.value = 1.0;

      // Volume modulates according to deceleration intensity
      gain.gain.setValueAtTime(0.09 * clampedIntensity, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

      // Connect brake source -> BiquadFilterNode (lowpass 1500Hz) -> gain -> destination
      osc.connect(brakeFilter);
      brakeFilter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.19);

      // 2. Subtle dirt/gravel slide sound layer whenever braking on loose surfaces
      if (surface === 'loose_gravel' || surface === 'dirt' || clampedIntensity > 0.4) {
        const slideBuffer = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * 0.18), this.ctx.sampleRate);
        const data = slideBuffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (data.length * 0.45));
        }

        const slideSrc = this.ctx.createBufferSource();
        slideSrc.buffer = slideBuffer;

        const slideFilter = this.ctx.createBiquadFilter();
        slideFilter.type = 'bandpass';
        slideFilter.frequency.setValueAtTime(surface === 'loose_gravel' ? 850 : 620, t);
        slideFilter.Q.setValueAtTime(1.8, t);

        const slideGain = this.ctx.createGain();
        slideGain.gain.setValueAtTime(0.08 * clampedIntensity, t);
        slideGain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

        slideSrc.connect(slideFilter);
        slideFilter.connect(slideGain);
        slideGain.connect(this.ctx.destination);

        slideSrc.start(t);
      }
    } catch {
      // Ignore
    }
  }

  toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.ctx && this.isMuted) {
      if (this.windGainNode) this.windGainNode.gain.value = 0;
      if (this.tireGainNode) this.tireGainNode.gain.value = 0;
      if (this.skidGainNode) this.skidGainNode.gain.value = 0;
      if (this.freehubGainNode) this.freehubGainNode.gain.value = 0;
    }
    return this.isMuted;
  }

  getMuted(): boolean {
    return this.isMuted;
  }
}

export const soundEngine = new SoundEngine();
