import type { ModelId } from '../types';

export type VoiceState =
  | 'connecting'
  | 'idle'
  | 'listening'
  | 'user_speaking'
  | 'processing'
  | 'assistant_speaking'
  | 'muted'
  | 'error'
  | 'ended';

export interface VoiceEngineCallbacks {
  onStateChange: (state: VoiceState) => void;
  onUserTranscript: (text: string, isFinal: boolean) => void;
  onAssistantTranscript: (text: string) => void;
  onAmplitudeChange: (inputLevel: number, outputLevel: number) => void;
  onError: (errorMsg: string) => void;
  onUserFinalSpeech: (finalText: string) => void;
}

export class VoiceEngine {
  private state: VoiceState = 'connecting';
  private callbacks: VoiceEngineCallbacks;

  // Web Speech Recognition
  private recognition: any = null;
  private isRecognizing: boolean = false;

  // Audio Context for amplitude analysis
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private animFrameId: number | null = null;

  // Speech Synthesis
  private synth: SpeechSynthesis | null = null;
  private currentVoice: SpeechSynthesisVoice | null = null;
  private isMuted: boolean = false;

  constructor(callbacks: VoiceEngineCallbacks) {
    this.callbacks = callbacks;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
      this.initVoices();
    }
  }

  private initVoices() {
    if (!this.synth) return;
    const updateVoice = () => {
      const voices = this.synth?.getVoices() || [];
      // Prefer Indian Hindi voice, fall back to Indian English or any Hindi
      const hiVoice = voices.find(v => v.lang.includes('hi') || v.name.includes('Hindi') || v.name.includes('hi-IN')) ||
                      voices.find(v => v.lang.includes('en-IN') || v.name.includes('India')) ||
                      voices[0];
      this.currentVoice = hiVoice || null;
    };

    updateVoice();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = updateVoice;
    }
  }

  public async start() {
    this.setState('connecting');
    try {
      // 1. Request microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // 2. Setup AudioContext Analyser
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioCtx();
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);

      this.startAmplitudeLoop();

      // 3. Setup Web Speech Recognition
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        throw new Error('Web Speech Recognition is not supported in this browser.');
      }

      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'hi-IN'; // Default Hindi / Indian accent recognition

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

        // Barge-in: Interrupt assistant if speaking when user starts talking
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
          this.callbacks.onUserFinalSpeech(finalText.trim());
          this.setState('processing');
        }
      };

      this.recognition.onerror = (err: any) => {
        if (err.error !== 'no-speech') {
          console.warn('Speech recognition error:', err.error);
        }
      };

      this.recognition.onend = () => {
        this.isRecognizing = false;
        // Auto restart if still in voice mode and not processing/speaking
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
      this.callbacks.onError(err.message || 'Could not access microphone.');
    }
  }

  private startAmplitudeLoop() {
    const dataArray = new Uint8Array(this.analyser?.frequencyBinCount || 128);

    const checkVolume = () => {
      if (!this.analyser) return;
      this.analyser.getByteFrequencyData(dataArray);

      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avg = sum / dataArray.length;
      const normalizedInput = Math.min(1, avg / 100);

      // Output level simulated during TTS speaking
      const normalizedOutput = this.state === 'assistant_speaking' ? 0.4 + Math.random() * 0.4 : 0;

      this.callbacks.onAmplitudeChange(normalizedInput, normalizedOutput);

      this.animFrameId = requestAnimationFrame(checkVolume);
    };

    checkVolume();
  }

  public speak(text: string, onEnd?: () => void) {
    if (!this.synth || this.isMuted) {
      if (onEnd) onEnd();
      return;
    }

    this.stopSpeaking();
    this.setState('assistant_speaking');

    // Clean markdown symbols for natural TTS speech
    const cleanText = text
      .replace(/\*+/g, '')
      .replace(/#+/g, '')
      .replace(/`{1,3}[\s\S]*?`{1,3}/g, '')
      .replace(/\[.*?\]\(.*?\)/g, '')
      .trim();

    if (!cleanText) {
      if (onEnd) onEnd();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
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
      console.warn('TTS error:', e);
      this.setState('listening');
      if (onEnd) onEnd();
    };

    this.synth.speak(utterance);
  }

  public stopSpeaking() {
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

  public setState(newState: VoiceState) {
    this.state = newState;
    this.callbacks.onStateChange(newState);
  }

  public stop() {
    this.setState('ended');

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
