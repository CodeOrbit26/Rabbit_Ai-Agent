export type VoiceVisualState =
  | 'connecting'
  | 'listening'
  | 'user_speaking'
  | 'thinking'
  | 'assistant_speaking'
  | 'muted'
  | 'error';

export interface VoiceEngineCallbacks {
  onStateChange: (state: VoiceVisualState) => void;
  onUserTranscript: (text: string, isFinal: boolean) => void;
  onAssistantTranscript: (text: string) => void;
  onAmplitudeChange: (inputLevel: number, outputLevel: number) => void;
  onError: (errorMsg: string) => void;
  onUserFinalSpeech: (finalText: string) => void;
}

export class VoiceEngine {
  private state: VoiceVisualState = 'connecting';
  private callbacks: VoiceEngineCallbacks;

  // Web Speech Recognition
  private recognition: any = null;
  private isRecognizing: boolean = false;

  // Web Audio API
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private inputAnalyser: AnalyserNode | null = null;
  private animFrameId: number | null = null;

  // Speech Synthesis
  private synth: SpeechSynthesis | null = null;
  private currentVoice: SpeechSynthesisVoice | null = null;
  private isMuted: boolean = false;
  private ttsQueue: string[] = [];
  private isTTSSpeaking: boolean = false;

  constructor(callbacks: VoiceEngineCallbacks) {
    this.callbacks = callbacks;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
      this.initVoices();
    }
  }

  private initVoices() {
    if (!this.synth) return;
    const loadVoice = () => {
      const voices = this.synth?.getVoices() || [];
      // Explicit Hindi & Indian voice selection priority
      const hiVoice =
        voices.find(v => v.lang === 'hi-IN' || v.name.includes('Google हिंदी') || v.name.includes('Hindi')) ||
        voices.find(v => v.lang.includes('hi')) ||
        voices.find(v => v.lang === 'en-IN' || v.name.includes('India')) ||
        voices[0];
      this.currentVoice = hiVoice || null;
    };

    loadVoice();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = loadVoice;
    }
  }

  public async start() {
    this.setState('connecting');

    try {
      // 1. Request microphone access with Web Audio constraints
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // 2. Audio Context Analyser for REAL Audio-Reactive Orb
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioCtx();
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.inputAnalyser = this.audioContext.createAnalyser();
      this.inputAnalyser.fftSize = 256;
      this.inputAnalyser.smoothingTimeConstant = 0.8;
      source.connect(this.inputAnalyser);

      this.startAmplitudeLoop();

      // 3. Setup Web Speech Recognition
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        throw new Error('Speech Recognition is not supported in this browser environment.');
      }

      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'hi-IN';

      this.recognition.onstart = () => {
        this.isRecognizing = true;
        this.setState('listening');
      };

      this.recognition.onresult = (event: any) => {
        let interimText = '';
        let finalText = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const res = event.results[i];
          if (res.isFinal) {
            finalText += res[0].transcript;
          } else {
            interimText += res[0].transcript;
          }
        }

        // BARGE-IN INTERRUPTION: If AI is speaking and user starts talking, stop AI audio!
        if ((interimText.trim() || finalText.trim()) && this.state === 'assistant_speaking') {
          this.stopSpeaking();
          this.setState('listening');
        }

        if (interimText.trim()) {
          this.setState('user_speaking');
          this.callbacks.onUserTranscript(interimText.trim(), false);
        }

        if (finalText.trim()) {
          this.callbacks.onUserTranscript(finalText.trim(), true);
          this.setState('thinking');
          this.callbacks.onUserFinalSpeech(finalText.trim());
        }
      };

      this.recognition.onerror = (err: any) => {
        if (err.error !== 'no-speech') {
          console.warn('Speech recognition error:', err.error);
        }
      };

      this.recognition.onend = () => {
        this.isRecognizing = false;
        if (this.state === 'listening' || this.state === 'user_speaking') {
          try {
            this.recognition.start();
          } catch {}
        }
      };

      this.recognition.start();
    } catch (err: any) {
      console.error('VoiceEngine start error:', err);
      this.setState('error');
      this.callbacks.onError(err.message || 'Microphone access is required for voice conversations.');
    }
  }

  private startAmplitudeLoop() {
    const dataArray = new Uint8Array(this.inputAnalyser?.frequencyBinCount || 128);

    const updateAmplitude = () => {
      if (this.inputAnalyser) {
        this.inputAnalyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const normalizedInput = Math.min(1, avg / 80);

        const normalizedOutput = this.state === 'assistant_speaking' ? 0.35 + Math.sin(Date.now() / 120) * 0.3 : 0;

        this.callbacks.onAmplitudeChange(normalizedInput, normalizedOutput);
      }

      this.animFrameId = requestAnimationFrame(updateAmplitude);
    };

    updateAmplitude();
  }

  public speakPhrase(text: string, onEnd?: () => void) {
    if (!this.synth || this.isMuted) {
      if (onEnd) onEnd();
      return;
    }

    this.stopSpeaking();
    this.setState('assistant_speaking');

    const cleanText = text
      .replace(/\*+/g, '')
      .replace(/#+/g, '')
      .replace(/`{1,3}[\s\S]*?`{1,3}/g, '')
      .replace(/\[.*?\]\(.*?\)/g, '')
      .trim();

    if (!cleanText) {
      this.setState('listening');
      if (onEnd) onEnd();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    utterance.lang = 'hi-IN';

    if (this.currentVoice) {
      utterance.voice = this.currentVoice;
    }

    utterance.onend = () => {
      this.setState('listening');
      if (onEnd) onEnd();
    };

    utterance.onerror = (e) => {
      console.warn('TTS synthesis error:', e);
      this.setState('listening');
      if (onEnd) onEnd();
    };

    this.synth.speak(utterance);
  }

  public stopSpeaking() {
    this.ttsQueue = [];
    this.isTTSSpeaking = false;
    if (this.synth) {
      this.synth.cancel();
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.stopSpeaking();
      this.setState('muted');
    } else {
      this.setState('listening');
    }
    return this.isMuted;
  }

  public setState(newState: VoiceVisualState) {
    this.state = newState;
    this.callbacks.onStateChange(newState);
  }

  public stop() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {}
      this.recognition = null;
    }

    this.stopSpeaking();

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}
