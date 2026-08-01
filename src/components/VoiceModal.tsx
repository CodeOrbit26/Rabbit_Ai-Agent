import React, { useEffect, useState, useRef } from 'react';
import { Mic, MicOff, X, Sparkles, AlertCircle } from 'lucide-react';
import { VoiceEngine, type VoiceState } from '../utils/voiceEngine';

interface VoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendSpeech: (text: string) => Promise<string>; // Sends text to LLM and returns response to speak
}

export const VoiceModal: React.FC<VoiceModalProps> = ({
  isOpen,
  onClose,
  onSendSpeech,
}) => {
  const [voiceState, setVoiceState] = useState<VoiceState>('connecting');
  const [userTranscript, setUserTranscript] = useState<string>('');
  const [assistantTranscript, setAssistantTranscript] = useState<string>('');
  const [inputLevel, setInputLevel] = useState<number>(0);
  const [outputLevel, setOutputLevel] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const engineRef = useRef<VoiceEngine | null>(null);
  const isProcessingRef = useRef<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;

    setErrorMsg(null);
    setUserTranscript('');
    setAssistantTranscript('');
    isProcessingRef.current = false;

    const engine = new VoiceEngine({
      onStateChange: (st) => setVoiceState(st),
      onUserTranscript: (text) => setUserTranscript(text),
      onAssistantTranscript: (text) => setAssistantTranscript(text),
      onAmplitudeChange: (inLvl, outLvl) => {
        setInputLevel(inLvl);
        setOutputLevel(outLvl);
      },
      onError: (msg) => setErrorMsg(msg),
      onUserFinalSpeech: async (finalText) => {
        if (isProcessingRef.current || !finalText.trim()) return;
        isProcessingRef.current = true;
        setAssistantTranscript('');

        try {
          // Send speech text to LLM and get real response
          const aiResponse = await onSendSpeech(finalText);
          setAssistantTranscript(aiResponse);

          // Speak AI response aloud via Hindi TTS
          engineRef.current?.speak(aiResponse, () => {
            isProcessingRef.current = false;
          });
        } catch (err: any) {
          console.error('Error getting AI voice response:', err);
          isProcessingRef.current = false;
          engineRef.current?.setState('listening');
        }
      },
    });

    engineRef.current = engine;
    engine.start();

    return () => {
      engine.stop();
      engineRef.current = null;
    };
  }, [isOpen, onSendSpeech]);

  if (!isOpen) return null;

  const handleToggleMute = () => {
    if (engineRef.current) {
      const muted = engineRef.current.toggleMute();
      setIsMuted(muted);
    }
  };

  const getStatusLabel = () => {
    switch (voiceState) {
      case 'connecting':
        return 'कनेक्ट हो रहा है... (Connecting)';
      case 'user_speaking':
      case 'listening':
        return 'बोलिए, मैं सुन रहा हूँ...';
      case 'processing':
        return 'समझ रहा हूँ... (Understanding)';
      case 'assistant_speaking':
        return 'बोल रहा हूँ... (Speaking)';
      case 'muted':
        return 'माइक्रोफ़ोन बंद है (Muted)';
      case 'error':
        return 'त्रुटि हुई (Error)';
      default:
        return 'बोलिए, मैं सुन रहा हूँ...';
    }
  };

  // Compute dynamic scale factor based on real audio amplitude
  const activeLevel = voiceState === 'assistant_speaking' ? outputLevel : inputLevel;
  const orbScale = 1 + activeLevel * 0.45;
  const rippleScale = 1 + activeLevel * 0.9;

  return (
    <div className="voice-modal-overlay">
      <div className="voice-modal-container">
        {/* Top Header */}
        <div className="voice-modal-header">
          <div className="voice-header-badge">
            <Sparkles size={14} className="sparkle-spin" />
            <span>Aria Hindi Voice Mode</span>
          </div>
          <button type="button" className="voice-close-btn" onClick={onClose} title="End Voice Mode">
            <X size={20} />
          </button>
        </div>

        {/* Central Voice Orb */}
        <div className="voice-orb-section">
          <div className="voice-orb-wrapper">
            {/* Pulsing Ripple Rings */}
            <div
              className={`voice-orb-ripple ring-1 ${voiceState}`}
              style={{ transform: `scale(${rippleScale})` }}
            />
            <div
              className={`voice-orb-ripple ring-2 ${voiceState}`}
              style={{ transform: `scale(${rippleScale * 1.15})` }}
            />

            {/* Core Orb Body */}
            <div
              className={`voice-orb-core ${voiceState}`}
              style={{ transform: `scale(${orbScale})` }}
            >
              <div className="voice-orb-gradient" />
            </div>
          </div>

          {/* Status Label */}
          <div className="voice-status-text">{getStatusLabel()}</div>
        </div>

        {/* Live Transcript Display */}
        <div className="voice-transcript-area">
          {userTranscript && (
            <div className="voice-transcript-item user">
              <span className="transcript-role">आप:</span>
              <span className="transcript-text">{userTranscript}</span>
            </div>
          )}
          {assistantTranscript && (
            <div className="voice-transcript-item assistant">
              <span className="transcript-role">Aria:</span>
              <span className="transcript-text">{assistantTranscript}</span>
            </div>
          )}
          {errorMsg && (
            <div className="voice-error-box">
              <AlertCircle size={15} />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Bottom Bar Controls */}
        <div className="voice-modal-controls">
          <button
            type="button"
            className={`voice-control-btn mic-btn ${isMuted ? 'muted' : ''}`}
            onClick={handleToggleMute}
            title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
          >
            {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
          </button>

          <button
            type="button"
            className="voice-control-btn end-btn"
            onClick={onClose}
            title="End Voice Conversation"
          >
            <X size={22} />
            <span>End Session</span>
          </button>
        </div>
      </div>
    </div>
  );
};
