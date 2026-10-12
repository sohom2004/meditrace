import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, AlertOctagon, Check, X, ShieldAlert, Sparkles, ExternalLink, Calendar } from 'lucide-react';
import { api } from '../api';

interface AssistantChatProps {
  activeProfileId: string;
  language: string;
  onActionCommitted?: () => void;
}

export const AssistantChat: React.FC<AssistantChatProps> = ({
  activeProfileId,
  language,
  onActionCommitted,
}) => {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emergencyAlert, setEmergencyAlert] = useState<any | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initialize or load conversation for this care profile
    const initConversation = async () => {
      try {
        const conv = await api.createConversation(activeProfileId);
        setConversationId(conv.id);
        const msgs = await api.getMessages(conv.id);
        setMessages(msgs);
      } catch (err) {
        console.error('Failed to init conversation:', err);
      }
    };
    initConversation();
  }, [activeProfileId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, emergencyAlert]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !conversationId || isLoading) return;

    const userText = inputText.trim();
    setInputText('');
    setEmergencyAlert(null);

    // Optimistic user message
    const tempUserMsg = {
      id: `temp-${Date.now()}`,
      sender_role: 'user',
      content: userText,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    setIsLoading(true);

    try {
      const res = await api.sendMessage(conversationId, activeProfileId, userText, language);

      if (res.safety?.emergency) {
        setEmergencyAlert(res.safety);
      }

      const assistantMsg = {
        id: res.message_id,
        sender_role: 'assistant',
        content: res.text,
        sources: res.sources,
        ui_blocks: res.ui_blocks,
        pending_actions: res.pending_actions,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setIsLoading(false);
    } catch (err: any) {
      setIsLoading(false);
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender_role: 'assistant',
          content: `Unable to complete turn: ${err.message}`,
          created_at: new Date().toISOString(),
        },
      ]);
    }
  };

  const handleConfirmAction = async (actionId: string) => {
    try {
      const res = await api.confirmPendingAction(actionId);
      alert(`Action successfully confirmed! ${res.summary}`);
      if (onActionCommitted) onActionCommitted();
    } catch (err: any) {
      alert(`Confirmation failed: ${err.message}`);
    }
  };

  const handleRejectAction = async (actionId: string) => {
    try {
      await api.rejectPendingAction(actionId);
      alert('Action cancelled.');
    } catch (err: any) {
      alert(`Failed to cancel: ${err.message}`);
    }
  };

  return (
    <div className="glass-card flex flex-col h-[600px] mb-6 overflow-hidden">
      {/* Chat Header */}
      <div className="px-5 py-3.5 border-b border-slate-200/50 flex items-center justify-between bg-white/40">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-500 text-white flex items-center justify-center shadow-xs">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900">Grounded Clinical Assistant</h3>
            <p className="text-[11px] text-slate-400 font-medium">
              Deterministic citations & Propose→Confirm actions
            </p>
          </div>
        </div>
        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200/50">
          Grounded Memory Active
        </span>
      </div>

      {/* Emergency Banner Alert */}
      {emergencyAlert && (
        <div className="p-4 bg-rose-50 border-b border-rose-200 text-rose-950 flex items-start gap-3">
          <AlertOctagon className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-bold text-rose-800 uppercase tracking-wider">
              Emergency Medical Alert
            </h4>
            <p className="text-xs text-rose-900 mt-1 leading-relaxed">
              Potential acute symptoms detected. Please seek immediate in-person emergency care.
            </p>
            <div className="flex items-center gap-2 mt-2">
              <a
                href="tel:112"
                className="px-3 py-1.5 rounded-lg bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 transition-colors shadow-xs"
              >
                Call 112 (National Emergency)
              </a>
              <a
                href="tel:108"
                className="px-3 py-1.5 rounded-lg bg-rose-100 text-rose-800 font-bold text-xs hover:bg-rose-200 transition-colors"
              >
                Call 108 (Ambulance)
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Message Stream */}
      <div className="flex-1 p-5 overflow-y-auto space-y-4">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
            <Bot className="w-10 h-10 mb-2 text-slate-300" />
            <p className="text-xs font-medium">
              Ask any health question, request a lab trend comparison, or prepare a doctor appointment.
            </p>
            <div className="flex flex-wrap gap-2 justify-center mt-3">
              <button
                onClick={() => setInputText('How has my HbA1c changed?')}
                className="text-[11px] px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
              >
                "How has my HbA1c changed?"
              </button>
              <button
                onClick={() => setInputText('Book an appointment with Dr. Mukherjee')}
                className="text-[11px] px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
              >
                "Book appointment with Dr. Mukherjee"
              </button>
            </div>
          </div>
        )}

        {messages.map((m) => {
          const isUser = m.sender_role === 'user';
          return (
            <div
              key={m.id}
              className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
            >
              <div
                className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 shadow-xs ${
                  isUser
                    ? 'bg-slate-900 text-white'
                    : 'bg-gradient-to-tr from-sky-500 to-indigo-600 text-white'
                }`}
              >
                {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
              </div>

              <div className={`max-w-[85%] space-y-2`}>
                <div
                  className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                    isUser
                      ? 'bg-slate-900 text-white rounded-tr-none'
                      : 'bg-white/90 text-slate-800 border border-slate-200/80 rounded-tl-none shadow-xs'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.content}</p>

                  {/* Sourced Citations */}
                  {m.sources && m.sources.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap gap-1.5">
                      <span className="text-[10px] font-bold text-slate-400 block w-full">
                        Verified Clinical Sources:
                      </span>
                      {m.sources.map((s: any, idx: number) => (
                        <div
                          key={idx}
                          className="px-2 py-0.5 rounded-md bg-sky-50 border border-sky-200 text-[10px] text-sky-800 font-mono flex items-center gap-1"
                        >
                          <span>{s.fact_id}</span>
                          {s.label && <span className="font-sans text-slate-500">({s.label})</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Propose -> Confirm Pending Action Cards */}
                {m.pending_actions && m.pending_actions.length > 0 && (
                  <div className="p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200 text-xs shadow-xs">
                    <div className="flex items-center gap-2 font-bold text-amber-900 mb-1">
                      <Calendar className="w-4 h-4 text-amber-600" />
                      <span>Confirmation Required (Propose → Confirm)</span>
                    </div>
                    {m.pending_actions.map((act: any) => (
                      <div key={act.id} className="mt-2">
                        <p className="text-slate-800 font-semibold">{act.summary}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          The assistant prepared this request. You must confirm to commit:
                        </p>
                        <div className="flex items-center gap-2 mt-2.5">
                          <button
                            onClick={() => handleConfirmAction(act.id)}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Confirm Booking</span>
                          </button>
                          <button
                            onClick={() => handleRejectAction(act.id)}
                            className="px-3 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Cancel</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-slate-400 p-2">
            <div className="w-2 h-2 rounded-full bg-sky-500 animate-bounce"></div>
            <div className="w-2 h-2 rounded-full bg-sky-500 animate-bounce [animation-delay:0.2s]"></div>
            <div className="w-2 h-2 rounded-full bg-sky-500 animate-bounce [animation-delay:0.4s]"></div>
            <span>Grounding with verified patient facts...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-200/50 bg-white/60 flex items-center gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={`Ask about ${activeProfileId ? 'medical history' : 'health records'}...`}
          className="flex-1 text-xs px-4 py-2.5 rounded-xl bg-white border border-slate-200 focus:outline-none focus:border-sky-500 transition-colors"
        />
        <button
          type="submit"
          disabled={!inputText.trim() || isLoading}
          className="p-2.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-40 transition-colors cursor-pointer"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
