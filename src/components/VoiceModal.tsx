import React, { useEffect, useState, useRef } from 'react';
import { Mic, MicOff, X, Sparkles, AlertCircle } from 'lucide-react';
import { VoiceEngine, type VoiceVisualState } from '../utils/voiceEngine';

interface VoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendSpeech: (text: string) => Promise<string>;
}

export const VoiceModal: React.FC<VoiceModalProps> = ({
  isOpen,
  onClose,
  onSendSpeech,
}) => {
  const [voiceState, setVoiceState] = useState<VoiceVisualState>('connecting');
  const [userTranscript, setUserTranscript] = useState<string>('');
  const [assistantTranscript, setAssistantTranscript] = useState<string>('');
  const [inputLevel, setInputLevel] = useState<number>(0);
  const [outputLevel, setOutputLevel] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const engineRef = useRef<VoiceEngine | null>(null);
  const isProcessingRef = useRef<boolean>(false);
  const orbCoreRef = useRef<HTMLDivElement>(null);

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

        // 60FPS DOM scale transform on Orb Core without triggering React component rerender!
        if (orbCoreRef.current) {
          const activeLevel = voiceState === 'assistant_speaking' ? outLvl : inLvl;
          const scaleVal = 1 + activeLevel * 0.4;
          orbCoreRef.current.style.transform = `scale(${scaleVal})`;
        }
      },
      onError: (msg) => setErrorMsg(msg),
      onUserFinalSpeech: async (finalText) => {
        if (isProcessingRef.current || !finalText.trim()) return;
        isProcessingRef.current = true;
        setAssistantTranscript('');

        try {
          // Send speech to LLM and get natural speech response
          const aiResponse = await onSendSpeech(finalText);
          setAssistantTranscript(aiResponse);

          // Speak AI response aloud via native Hindi TTS
          engineRef.current?.speakPhrase(aiResponse, () => {
            isProcessingRef.current = false;
          });
        } catch (err: any) {
          console.error('Voice AI error:', err);
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

  const getStatusText = () => {
    switch (voiceState) {
      case 'connecting':
        return 'कनेक्ट हो रहा है';
      case 'user_speaking':
      case 'listening':
        return 'मैं सुन रहा हूँ';
      case 'thinking':
        return 'समझ रहा हूँ';
      case 'assistant_speaking':
        return 'जवाब दे रहा हूँ';
      case 'muted':
        return 'माइक बंद है';
      case 'error':
        return 'कनेक्शन समस्या';
      default:
        return 'मैं सुन रहा हूँ';
    }
  };

  return (
    <div className="voice-modal-overlay">
      <div className="voice-modal-container">
        {/* Header */}
        <div className="voice-modal-header">
          <div className="voice-header-brand">
            <Sparkles size={16} className="voice-sparkle-icon" />
            <div className="voice-title-group">
              <span className="voice-brand-name">Qova</span>
              <span className="voice-lang-sub">QuantaForge Autonomous Intelligence</span>
            </div>
          </div>
          <button type="button" className="voice-close-icon-btn" onClick={onClose} title="Close Voice Mode">
            <X size={18} />
          </button>
        </div>

        {/* Center Organic Animated Orb */}
        <div className="voice-orb-section">
          <div className="voice-orb-wrapper">
            <div className={`voice-orb-glow ${voiceState}`} />
            <div className={`voice-orb-ring ring-outer ${voiceState}`} />
            <div className={`voice-orb-ring ring-inner ${voiceState}`} />

            <div
              ref={orbCoreRef}
              className={`voice-orb-core ${voiceState}`}
            >
              <div className="voice-orb-highlight" />
            </div>
          </div>

          <div className="voice-status-text">{getStatusText()}</div>
        </div>

        {/* Live Transcript Area: ONLY visible when speech content exists */}
        {(userTranscript || assistantTranscript || errorMsg) && (
          <div className="voice-transcript-area">
            {userTranscript && (
              <div className="voice-transcript-item user">
                <span className="transcript-role">आप:</span>
                <span className="transcript-text">{userTranscript}</span>
              </div>
            )}
            {assistantTranscript && (
              <div className="voice-transcript-item assistant">
                <span className="transcript-role">Qova:</span>
                <span className="transcript-text">{assistantTranscript}</span>
              </div>
            )}
            {errorMsg && (
              <div className="voice-error-box">
                <AlertCircle size={14} />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>
        )}

        {/* Bottom Control Dock */}
        <div className="voice-control-dock">
          <button
            type="button"
            className={`voice-dock-btn ${isMuted ? 'muted' : ''}`}
            onClick={handleToggleMute}
          >
            {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
            <span>{isMuted ? 'Unmute' : 'Mute'}</span>
          </button>

          <button
            type="button"
            className="voice-dock-btn end-btn"
            onClick={onClose}
          >
            <X size={18} />
            <span>End Session</span>
          </button>
        </div>
      </div>
    </div>
  );
};
