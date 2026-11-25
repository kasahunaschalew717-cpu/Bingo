// Hybrid Audio Service:
// 1. Studio neural formal British female voice clips (en-GB-SoniaNeural) for all 75 balls & calls
// 2. Intelligent Web Speech API fallback (strictly female formal English voices)
// 3. Web Audio API tactile chimes & effects

const FEMALE_VOICE_PRIORITY = [
  'sonia',
  'libby',
  'hazel',
  'google uk english female',
  'aria',
  'jenny',
  'samantha',
  'serena',
  'kate',
  'victoria',
  'karen',
  'zira',
  'susan',
  'female'
];

const MALE_VOICE_BLOCKLIST = [
  'david',
  'mark',
  'george',
  'daniel',
  'alex',
  'fred',
  'thomas',
  'ryan',
  'guy',
  'male'
];

class SoundService {
  private ctx: AudioContext | null = null;
  private voiceAudio: HTMLAudioElement | null = null;
  private callTimeout: ReturnType<typeof setTimeout> | null = null;
  private unlocked: boolean = false;
  public enabled: boolean = true;

  private getContext(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private getVoiceAudio(): HTMLAudioElement | null {
    if (typeof window === 'undefined') return null;
    if (!this.voiceAudio) {
      this.voiceAudio = new Audio();
      this.voiceAudio.preload = 'auto';
    }
    return this.voiceAudio;
  }

  /**
   * Call from any user click/tap to unlock mobile WebView audio playback.
   * Retries until playback unlock actually succeeds.
   */
  unlockAudio() {
    if (this.unlocked || typeof window === 'undefined') return;
    try {
      const ctx = this.getContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      const audio = this.getVoiceAudio();
      if (audio) {
        audio.muted = true;
        audio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
        const p = audio.play();
        if (p && typeof p.then === 'function') {
          p.then(() => {
            audio.pause();
            audio.muted = false;
            this.unlocked = true;
          }).catch(() => {
            audio.muted = false;
          });
        } else {
          this.unlocked = true;
        }
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.getVoices();
      }
    } catch {
      // Retry on next interaction
    }
  }

  setEnabled(value: boolean) {
    this.enabled = value;
    if (!value) {
      this.stopVoice();
    } else {
      this.unlockAudio();
    }
  }

  stopVoice() {
    if (this.callTimeout) {
      clearTimeout(this.callTimeout);
      this.callTimeout = null;
    }
    if (this.voiceAudio) {
      this.voiceAudio.pause();
      this.voiceAudio.currentTime = 0;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  private selectFormalFemaleVoice(): SpeechSynthesisVoice | null {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith('en'));
    if (voices.length === 0) return null;

    const nonMale = voices.filter((v) => {
      const lower = v.name.toLowerCase();
      return !MALE_VOICE_BLOCKLIST.some((m) => lower.includes(m));
    });
    const candidates = nonMale.length > 0 ? nonMale : voices;

    for (const kw of FEMALE_VOICE_PRIORITY) {
      const found = candidates.find((v) => v.name.toLowerCase().includes(kw));
      if (found) return found;
    }

    return candidates.find((v) => v.lang === 'en-GB') || candidates[0];
  }

  private speakFallback(text: string) {
    if (!this.enabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      const voice = this.selectFormalFemaleVoice();
      if (voice) utter.voice = voice;
      utter.lang = voice?.lang || 'en-GB';
      utter.rate = 0.94;
      utter.pitch = 1.05;
      utter.volume = 1.0;
      window.speechSynthesis.speak(utter);
    } catch {
      // Speech fallback ignored
    }
  }

  private playVoiceClip(url: string, fallbackText: string) {
    if (!this.enabled) return;
    const audio = this.getVoiceAudio();
    if (!audio) {
      this.speakFallback(fallbackText);
      return;
    }

    try {
      let fallbackTriggered = false;
      const triggerFallbackOnce = () => {
        if (fallbackTriggered) return;
        fallbackTriggered = true;
        this.speakFallback(fallbackText);
      };

      audio.pause();
      audio.currentTime = 0;
      audio.muted = false;
      audio.volume = 1.0;
      audio.onerror = () => triggerFallbackOnce();
      audio.src = url;

      const promise = audio.play();
      if (promise && typeof promise.catch === 'function') {
        promise.catch((err: unknown) => {
          // Ignore AbortError when a newer ball call supersedes an earlier loading clip
          if (err instanceof Error && err.name === 'AbortError') return;
          triggerFallbackOnce();
        });
      }
    } catch {
      this.speakFallback(fallbackText);
    }
  }

  /**
   * Plays soft chime followed by formal British female voice calling the ball (e.g. "B, 12.")
   */
  playBallCall(ball: { letter: 'B' | 'I' | 'N' | 'G' | 'O'; number: number }) {
    if (!this.enabled) return;
    this.playBallDrop(660, 0.06);

    if (this.callTimeout) clearTimeout(this.callTimeout);
    this.callTimeout = setTimeout(() => {
      this.playVoiceClip(
        `/audio/calls/${ball.letter}-${ball.number}.mp3`,
        `${ball.letter}, ${ball.number}.`
      );
    }, 110);
  }

  playRoundStart() {
    if (!this.enabled) return;
    this.playVoiceClip(
      '/audio/calls/round-start.mp3',
      'The round is now beginning. Good luck.'
    );
  }

  playBingoAnnouncement() {
    if (!this.enabled) return;
    this.playBingoCall();
    if (this.callTimeout) clearTimeout(this.callTimeout);
    this.callTimeout = setTimeout(() => {
      this.playVoiceClip(
        '/audio/calls/bingo.mp3',
        'Bingo! Congratulations to our winner.'
      );
    }, 280);
  }

  // Chime when a ball is called
  playBallDrop(frequency: number = 587.33, peakGain: number = 0.14) {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(frequency * 1.45, ctx.currentTime + 0.09);
      osc.frequency.exponentialRampToValueAtTime(frequency, ctx.currentTime + 0.25);

      gain.gain.setValueAtTime(peakGain, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.32);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.32);
    } catch {
      // Audio error ignored safely
    }
  }

  // Pop sound when marking a card cell
  playDaub() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(350, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(700, ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch {
      // Audio error ignored
    }
  }

  // Triumphant Fanfare for Line or Bingo Claim
  playBingoCall() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const notes = [440, 554.37, 659.25, 880];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);

        gain.gain.setValueAtTime(0.18, ctx.currentTime + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.08 + 0.5);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + idx * 0.08);
        osc.stop(ctx.currentTime + idx * 0.08 + 0.5);
      });
    } catch {
      // Audio error ignored
    }
  }

  // Win celebration
  playWin() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.12);

        gain.gain.setValueAtTime(0.22, ctx.currentTime + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.12 + 0.8);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + idx * 0.12);
        osc.stop(ctx.currentTime + idx * 0.12 + 0.8);
      });
    } catch {
      // Audio error ignored
    }
  }

  // Countdown tick
  playTick() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(800, ctx.currentTime);

      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.04);
    } catch {
      // Audio error ignored
    }
  }
}

export const sound = new SoundService();
