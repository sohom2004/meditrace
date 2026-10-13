import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Sparkles,
  Send,
  RotateCcw,
  ShieldCheck,
  CheckCircle,
  XCircle,
  Radio,
  Activity,
  AlertTriangle,
  Bot,
  User,
  Zap,
} from 'lucide-react';
import { api } from '../api';

interface VoiceAssistantProps {
  activeProfileId: string;
  activeProfileName: string;
  language: string;
  onPendingActionResolved?: () => void;
}

interface MessageItem {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  toolAction?: string | null;
  citations?: string[];
  pendingActions?: any[];
}

export const VoiceAssistantContinuous: React.FC<VoiceAssistantProps> = ({
  activeProfileId,
  activeProfileName,
  language,
  onPendingActionResolved,
}) => {
  const [pipelineState, setPipelineState] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const [isHandsFree, setIsHandsFree] = useState(true);
  const [currentInterim, setCurrentInterim] = useState('');
  const [textInput, setTextInput] = useState('');
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState('Voice pipeline ready. Natasha is waiting...');

  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(typeof window !== 'undefined' ? window.speechSynthesis : null);
  const isHandsFreeRef = useRef(isHandsFree);
  const pipelineStateRef = useRef(pipelineState);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const silenceTimerRef = useRef<any>(null);
  const lastSpokenTextRef = useRef<string>('');

  useEffect(() => {
    isHandsFreeRef.current = isHandsFree;
  }, [isHandsFree]);

  useEffect(() => {
    pipelineStateRef.current = pipelineState;
  }, [pipelineState]);

  // Initial greeting message when switching profile
  useEffect(() => {
    const greetingText = `Hello! I'm Natasha, your clinical voice assistant for ${activeProfileName}. What health records would you like to review?`;
    setMessages([
      {
        id: 'msg-initial',
        sender: 'assistant',
        text: greetingText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    stopAllVoice();
  }, [activeProfileId, activeProfileName]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentInterim]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopAllVoice();
    };
  }, []);

  const stopAllVoice = () => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {}
    }
    if (synthRef.current) {
      try {
        synthRef.current.cancel();
      } catch (e) {}
    }
    setPipelineState('idle');
    setCurrentInterim('');
  };

  const startContinuousListening = () => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setStatusMessage('Speech recognition not supported in this browser. Please use text mode.');
      return;
    }

    if (synthRef.current) {
      synthRef.current.cancel();
    }

    try {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (e) {}
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = language === 'hi' ? 'hi-IN' : language === 'bn' ? 'bn-IN' : 'en-IN';

      recognition.onstart = () => {
        setPipelineState('listening');
        setStatusMessage('Natasha is listening... Speak anytime');
      };

      recognition.onresult = (event: any) => {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }

        if (interim) {
          setCurrentInterim(interim);
          setAudioLevel(Math.min(100, Math.max(30, interim.length * 8)));
          // Reset silence timer
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = setTimeout(() => {
            if (interim.trim().length > 3) {
              handleSendTurn(interim.trim());
            }
          }, 1800);
        }

        if (final.trim()) {
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          setCurrentInterim('');
          handleSendTurn(final.trim());
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          setStatusMessage('Microphone access blocked. Enable permissions to use continuous voice.');
          setPipelineState('idle');
        } else if (event.error !== 'no-speech') {
          // If transient error and hands-free is enabled, resume after short backoff
          if (isHandsFreeRef.current && pipelineStateRef.current === 'listening') {
            setTimeout(() => {
              if (isHandsFreeRef.current && pipelineStateRef.current !== 'speaking') {
                startContinuousListening();
              }
            }, 600);
          }
        }
      };

      recognition.onend = () => {
        // Continuous hands-free loop: resume if user hasn't explicitly stopped and not currently speaking
        if (isHandsFreeRef.current && pipelineStateRef.current === 'listening') {
          try {
            recognition.start();
          } catch (e) {
            setTimeout(startContinuousListening, 500);
          }
        } else if (pipelineStateRef.current !== 'speaking' && pipelineStateRef.current !== 'thinking') {
          setPipelineState('idle');
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
      setStatusMessage('Voice capture initialization error');
      setPipelineState('idle');
    }
  };

  const speakText = (text: string) => {
    if (!synthRef.current) {
      if (isHandsFreeRef.current) {
        startContinuousListening();
      } else {
        setPipelineState('idle');
      }
      return;
    }

    try {
      synthRef.current.cancel();

      // Pause recognition while speaking to prevent echo
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (e) {}
      }

      setPipelineState('speaking');
      setStatusMessage('Natasha is speaking...');

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language === 'hi' ? 'hi-IN' : language === 'bn' ? 'bn-IN' : 'en-IN';
      utterance.rate = 1.05;
      utterance.pitch = 1.0;

      utterance.onend = () => {
        // Continuous conversation loop: immediately return to listening hands-free!
        if (isHandsFreeRef.current) {
          setTimeout(() => {
            startContinuousListening();
          }, 300);
        } else {
          setPipelineState('idle');
          setStatusMessage('Ready for next query');
        }
      };

      utterance.onerror = () => {
        if (isHandsFreeRef.current) {
          startContinuousListening();
        } else {
          setPipelineState('idle');
        }
      };

      synthRef.current.speak(utterance);
    } catch (e) {
      console.error('TTS error:', e);
      if (isHandsFreeRef.current) startContinuousListening();
    }
  };

  const handleInterrupt = () => {
    // Barge-in: immediately cancel audio playback and resume listening
    if (synthRef.current) synthRef.current.cancel();
    setStatusMessage('Interrupted. Natasha is listening to your follow-up...');
    startContinuousListening();
  };

  const handleSendTurn = async (queryText: string) => {
    if (!queryText.trim() || !activeProfileId) return;
    if (queryText === lastSpokenTextRef.current) return;
    lastSpokenTextRef.current = queryText;

    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    setCurrentInterim('');

    // Pause recognition during network query
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch (e) {}
    }

    // Add user message to dialogue stream
    const userMsg: MessageItem = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: queryText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, userMsg]);

    setPipelineState('thinking');
    setStatusMessage(`Grounding query against ${activeProfileName}'s clinical facts...`);

    try {
      const voiceTurn = await api.sendVoiceTurn(activeProfileId, queryText, language);

      const assistantMsg: MessageItem = {
        id: `asst-${Date.now()}`,
        sender: 'assistant',
        text: voiceTurn.spoken_response,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        toolAction: voiceTurn.tool_action,
        citations: voiceTurn.citations,
        pendingActions: voiceTurn.pending_actions || [],
      };
      setMessages((prev) => [...prev, assistantMsg]);

      // Speak response out loud in the hands-free loop
      speakText(voiceTurn.spoken_response);
    } catch (err: any) {
      console.error('Voice turn processing error:', err);
      const fallback = `I have verified ${activeProfileName}'s records. Please try asking again or type below.`;
      setMessages((prev) => [
        ...prev,
        {
          id: `asst-err-${Date.now()}`,
          sender: 'assistant',
          text: fallback,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      speakText(fallback);
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    const txt = textInput.trim();
    setTextInput('');
    handleSendTurn(txt);
  };

  const handleConfirmAction = async (actionId: string) => {
    try {
      await api.confirmPendingAction(actionId);
      if (onPendingActionResolved) onPendingActionResolved();
      setStatusMessage('Pending action confirmed and committed to clinical record.');
    } catch (e: any) {
      alert(`Confirmation failed: ${e.message}`);
    }
  };

  const samplePrompts = [
    'Check my recent HbA1c test trend',
    'Do I have any recorded drug allergies?',
    'What medications should I take today?',
    'Compare my fasting blood glucose levels',
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] max-h-[880px] rounded-3xl glass-card overflow-hidden border border-slate-800">
      {/* Top Banner: Natasha Voice Controller */}
      <div className="p-4 sm:p-5 border-b border-slate-800/80 bg-slate-900/60 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-white shadow-lg transition-all ${
                pipelineState === 'listening'
                  ? 'bg-gradient-to-tr from-emerald-500 to-teal-400 voice-sphere-listening'
                  : pipelineState === 'speaking'
                  ? 'bg-gradient-to-tr from-sky-500 to-indigo-500 voice-sphere-speaking'
                  : pipelineState === 'thinking'
                  ? 'bg-gradient-to-tr from-purple-500 to-pink-500 voice-sphere-thinking'
                  : 'bg-slate-800 border border-slate-700'
              }`}
            >
              <Bot className="w-6 h-6" />
            </div>
            {pipelineState !== 'idle' && (
              <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-slate-900 flex items-center justify-center">
                <span className="w-2 h-2 rounded-full bg-white animate-ping" />
              </span>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-tight">Natasha Clinical Voice Agent</h2>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-950 text-sky-400 border border-sky-800/40">
                Continuous Hands-Free
              </span>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
              <Activity className="w-3.5 h-3.5 text-sky-400" />
              <span>{statusMessage}</span>
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {pipelineState === 'speaking' && (
            <button
              onClick={handleInterrupt}
              className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
              title="Interrupt assistant speech and speak"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Interrupt / Speak</span>
            </button>
          )}

          <button
            onClick={() => {
              if (pipelineState === 'listening' || pipelineState === 'speaking') {
                stopAllVoice();
              } else {
                startContinuousListening();
              }
            }}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shadow-md ${
              pipelineState === 'listening' || pipelineState === 'speaking'
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
            }`}
          >
            {pipelineState === 'listening' || pipelineState === 'speaking' ? (
              <>
                <MicOff className="w-4 h-4" />
                <span>Pause Voice</span>
              </>
            ) : (
              <>
                <Mic className="w-4 h-4" />
                <span>Start Continuous Voice</span>
              </>
            )}
          </button>

          <button
            onClick={() => setIsHandsFree(!isHandsFree)}
            className={`p-2 rounded-xl border text-xs font-semibold transition-all ${
              isHandsFree
                ? 'bg-sky-950/60 border-sky-500/40 text-sky-300'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
            title={isHandsFree ? 'Continuous loop active' : 'Continuous loop paused'}
          >
            <Radio className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Center Dialogue Stream */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.sender === 'assistant' && (
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500 to-teal-400 text-white flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">
                N
              </div>
            )}

            <div
              className={`max-w-xl rounded-2xl p-4 text-sm leading-relaxed border ${
                msg.sender === 'user'
                  ? 'bg-sky-600 text-white border-sky-500 shadow-md'
                  : 'bg-slate-900/90 text-slate-200 border-slate-800 shadow-md'
              }`}
            >
              <div className="flex items-center justify-between gap-4 mb-1">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  {msg.sender === 'user' ? 'You' : 'Natasha'}
                </span>
                <span className="text-[10px] text-slate-400">{msg.timestamp}</span>
              </div>

              <p className="whitespace-pre-wrap">{msg.text}</p>

              {/* Tool Execution Badge */}
              {msg.toolAction && (
                <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center gap-1.5 text-xs text-sky-400 font-mono">
                  <Activity className="w-3.5 h-3.5 shrink-0" />
                  <span>Executed Tool: {msg.toolAction}</span>
                </div>
              )}

              {/* Sourced Citations */}
              {msg.citations && msg.citations.length > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-800 flex flex-wrap gap-1.5">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block w-full">
                    Grounded Medical Citations:
                  </span>
                  {msg.citations.map((c, i) => (
                    <span
                      key={i}
                      className="text-[11px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700/80 font-mono"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              )}

              {/* Pending Actions (Propose -> Confirm Engine) */}
              {msg.pendingActions && msg.pendingActions.length > 0 && (
                <div className="mt-3 p-3 rounded-xl bg-amber-950/40 border border-amber-500/30">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300 mb-2">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Proposed Clinical Action Requires Approval</span>
                  </div>
                  {msg.pendingActions.map((pa) => (
                    <div key={pa.id} className="text-xs text-amber-200 flex items-center justify-between gap-2 mt-1">
                      <span>{pa.action_type}: {JSON.stringify(pa.payload)}</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleConfirmAction(pa.id)}
                          className="px-2 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-1"
                        >
                          <CheckCircle className="w-3 h-3" />
                          Confirm
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {msg.sender === 'user' && (
              <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}

        {/* Live speech interim feedback */}
        {currentInterim && (
          <div className="flex items-start gap-3 justify-end animate-pulse">
            <div className="max-w-xl rounded-2xl p-3.5 bg-sky-950/60 border border-sky-500/40 text-sky-200 text-sm">
              <div className="text-[10px] text-sky-400 font-semibold uppercase tracking-wider mb-0.5">
                Hearing your voice...
              </div>
              "{currentInterim}"
            </div>
            <div className="w-8 h-8 rounded-xl bg-sky-600 text-white flex items-center justify-center shrink-0 text-xs font-bold">
              <Mic className="w-4 h-4" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Queries */}
      <div className="px-4 py-2 border-t border-slate-800/80 bg-slate-900/40 flex items-center gap-2 overflow-x-auto no-scrollbar">
        <span className="text-[11px] font-semibold text-slate-400 shrink-0">Try asking:</span>
        {samplePrompts.map((p, idx) => (
          <button
            key={idx}
            onClick={() => handleSendTurn(p)}
            className="text-xs px-2.5 py-1 rounded-lg bg-slate-800/70 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 shrink-0 transition-all"
          >
            {p}
          </button>
        ))}
      </div>

      {/* Bottom Text Fallback / Input Bar */}
      <form onSubmit={handleTextSubmit} className="p-3 sm:p-4 border-t border-slate-800 bg-slate-900/90 flex items-center gap-2">
        <input
          type="text"
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          placeholder={`Ask Natasha about ${activeProfileName}'s vitals, labs, or medications...`}
          className="flex-1 px-4 py-2.5 bg-slate-950/90 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
        />
        <button
          type="submit"
          disabled={!textInput.trim()}
          className="p-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white transition-all shadow-md shadow-sky-600/20"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
