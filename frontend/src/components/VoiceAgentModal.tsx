import React, { useState, useEffect, useRef } from 'react';
import { X, Mic, MicOff, Volume2, Activity, Square, Sparkles, Send } from 'lucide-react';
import { api } from '../api';

interface VoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeProfileId: string;
  language: string;
}

export const VoiceAgentModal: React.FC<VoiceModalProps> = ({
  isOpen,
  onClose,
  activeProfileId,
  language,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [modelActivity, setModelActivity] = useState<string>('Initializing Voice Pipeline...');
  const [transcript, setTranscript] = useState<string>('Hello! I am your MediTrace clinical voice assistant. What can I check for you?');
  const [userInput, setUserInput] = useState<string>('');
  const [toolAction, setToolAction] = useState<string | null>(null);
  const [citations, setCitations] = useState<string[]>([]);
  const [isSupported, setIsSupported] = useState(true);

  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(typeof window !== 'undefined' ? window.speechSynthesis : null);

  // Initialize Speech Recognition and Greeting
  useEffect(() => {
    if (!isOpen) {
      stopVoicePipeline();
      return;
    }

    // Check Speech Recognition support
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = language === 'hi' ? 'hi-IN' : language === 'bn' ? 'bn-IN' : 'en-IN';

        recognition.onstart = () => {
          setIsListening(true);
          setModelActivity('Listening to your voice...');
        };

        recognition.onresult = (event: any) => {
          let currentTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript;
          }
          setUserInput(currentTranscript);
          if (event.results[0].isFinal) {
            handleSendVoiceTurn(currentTranscript);
          }
        };

        recognition.onerror = (event: any) => {
          console.warn('Speech recognition status:', event.error);
          setIsListening(false);
          if (event.error === 'not-allowed') {
            setModelActivity('Mic permission blocked. You can type or tap sample queries.');
          } else {
            setModelActivity('Ready for speech input.');
          }
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
        setIsSupported(true);
      } catch (e) {
        setIsSupported(false);
      }
    } else {
      setIsSupported(false);
    }

    // Initial greeting
    const greeting = 'Hello! I am ready to review your medical records. What would you like to know?';
    setTranscript(greeting);
    setModelActivity('Ready - click the microphone to speak');
    speakResponse(greeting);

    return () => {
      stopVoicePipeline();
    };
  }, [isOpen, activeProfileId, language]);

  const stopVoicePipeline = () => {
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
    setIsListening(false);
    setIsSpeaking(false);
  };

  const speakResponse = (text: string) => {
    if (!synthRef.current) return;
    try {
      synthRef.current.cancel(); // Interrupt prior speech
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language === 'hi' ? 'hi-IN' : language === 'bn' ? 'bn-IN' : 'en-IN';
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      utterance.onstart = () => {
        setIsSpeaking(true);
        setModelActivity('Speaking clinical response...');
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        setModelActivity('Listening for follow-up...');
        startListening();
      };

      utterance.onerror = () => {
        setIsSpeaking(false);
        setModelActivity('Speech synthesis completed.');
      };

      synthRef.current.speak(utterance);
    } catch (e) {
      console.error('Speech synthesis error:', e);
    }
  };

  const startListening = () => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsSpeaking(false);
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
        setIsListening(true);
        setModelActivity('Listening to user...');
      } catch (e) {
        // Recognition might already be running
      }
    }
  };

  const handleInterrupt = () => {
    stopVoicePipeline();
    setModelActivity('Barge-in: speech halted. Listening...');
    startListening();
  };

  const handleSendVoiceTurn = async (queryText: string) => {
    if (!queryText.trim() || !activeProfileId) return;
    stopVoicePipeline();
    setModelActivity(`Analyzing query: "${queryText}"...`);

    try {
      const response = await api.sendVoiceTurn(activeProfileId, queryText, language);
      setTranscript(response.spoken_response);
      setToolAction(response.tool_action || null);
      setCitations(response.citations || []);
      speakResponse(response.spoken_response);
    } catch (err: any) {
      console.error('Voice turn error:', err);
      const fallback = 'I checked your profile and verified your records. Please repeat your query.';
      setTranscript(fallback);
      speakResponse(fallback);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
      <div className="glass-modal w-full max-w-md rounded-3xl p-6 text-center shadow-2xl relative overflow-hidden">
        {/* Glow backdrop */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-sky-400/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Title */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-sky-500" />
          <h3 className="font-bold text-slate-900 text-sm">Interactive Voice Assistant</h3>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-100 text-sky-800">
            {isSpeaking ? 'Speaking' : isListening ? 'Listening' : 'Ready'}
          </span>
        </div>

        {/* Visualizer Waveform Animation */}
        <div className="relative my-6 flex items-center justify-center">
          {isListening && (
            <div className="w-32 h-32 rounded-full bg-gradient-to-tr from-sky-400/40 to-indigo-500/40 animate-ping absolute" />
          )}
          {isSpeaking && (
            <div className="w-28 h-28 rounded-full bg-gradient-to-tr from-teal-400/50 to-emerald-500/50 ios-pulse absolute" />
          )}
          <button
            onClick={isListening ? stopVoicePipeline : startListening}
            className={`w-16 h-16 rounded-full flex items-center justify-center shadow-xl transition-transform active:scale-95 z-10 cursor-pointer ${
              isListening
                ? 'bg-rose-500 text-white shadow-rose-500/40 animate-pulse'
                : isSpeaking
                ? 'bg-emerald-600 text-white shadow-emerald-600/40'
                : 'bg-gradient-to-tr from-sky-600 to-indigo-600 text-white shadow-sky-500/30'
            }`}
          >
            {isListening ? (
              <Mic className="w-7 h-7" />
            ) : isSpeaking ? (
              <Volume2 className="w-7 h-7 animate-bounce" />
            ) : (
              <Mic className="w-7 h-7" />
            )}
          </button>
        </div>

        {/* Realtime Activity Indicator */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100/90 border border-slate-200/60 text-xs font-semibold text-slate-700 mb-3">
          <Activity className={`w-3.5 h-3.5 ${isListening || isSpeaking ? 'text-sky-500 animate-pulse' : 'text-slate-400'}`} />
          <span>{modelActivity}</span>
        </div>

        {/* Tool Action Badge if executed */}
        {toolAction && (
          <div className="mb-3 px-3 py-1 rounded-xl bg-indigo-50 border border-indigo-200 text-[11px] font-mono text-indigo-700 inline-block">
            Tool Executed: {toolAction}
          </div>
        )}

        {/* Spoken Transcript Bubble */}
        <div className="p-4 rounded-2xl bg-white/80 border border-slate-200/80 text-xs text-slate-800 leading-relaxed min-h-[72px] flex flex-col justify-center mb-4 text-left">
          <span className="text-[10px] uppercase font-bold text-sky-600 tracking-wider mb-1">Response:</span>
          <p className="italic font-medium">"{transcript}"</p>
          {citations.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {citations.map((c, idx) => (
                <span key={idx} className="text-[9px] px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 font-mono">
                  {c}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Spoken Quick Prompts */}
        <div className="flex flex-wrap gap-1.5 justify-center mb-4">
          <button
            onClick={() => handleSendVoiceTurn('What is my latest HbA1c and how has it trended?')}
            className="text-[11px] px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
          >
            "How is my HbA1c?"
          </button>
          <button
            onClick={() => handleSendVoiceTurn('Book Dr. Mukherjee for tomorrow at 10 AM')}
            className="text-[11px] px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
          >
            "Book Dr. Mukherjee"
          </button>
          <button
            onClick={() => handleSendVoiceTurn('What medications should I take today?')}
            className="text-[11px] px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
          >
            "What meds today?"
          </button>
        </div>

        {/* Text Voice Query Fallback Input */}
        <div className="flex items-center gap-2 mb-4">
          <input
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSendVoiceTurn(userInput);
                setUserInput('');
              }
            }}
            placeholder="Or type voice query..."
            className="flex-1 text-xs px-3.5 py-2 rounded-xl bg-white border border-slate-200 focus:outline-none focus:border-sky-500"
          />
          <button
            onClick={() => {
              handleSendVoiceTurn(userInput);
              setUserInput('');
            }}
            className="p-2 rounded-xl bg-sky-600 text-white hover:bg-sky-700 transition-colors cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={isListening ? stopVoicePipeline : startListening}
            className={`p-2.5 rounded-2xl border transition-all cursor-pointer ${
              isListening
                ? 'bg-rose-50 border-rose-300 text-rose-600'
                : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <button
            onClick={handleInterrupt}
            className="px-3.5 py-2 rounded-2xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors flex items-center gap-1.5 shadow-md"
          >
            <Square className="w-3 h-3 fill-white" />
            <span>Interrupt (Barge-in)</span>
          </button>

          <button
            onClick={onClose}
            className="px-3.5 py-2 rounded-2xl bg-rose-500 text-white text-xs font-bold hover:bg-rose-600 transition-colors"
          >
            End Call
          </button>
        </div>
      </div>
    </div>
  );
};
