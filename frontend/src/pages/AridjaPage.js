import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Gem, Send, ExternalLink, ArrowLeft, Sparkles, Wifi, WifiOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { axiosInstance } from '../App';

const ARIDJA_SITE = 'https://aridja.online';

const SUGGESTIONS = [
  'How do I start building income-generating assets?',
  'What does my net worth really include?',
  'How can my network grow my wealth?',
];

const AridjaPage = ({ user }) => {
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [messages, setMessages] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem('aridja_chat') || '[]');
    } catch {
      return [];
    }
  });
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    axiosInstance.get('/aridja/status').then((r) => setStatus(r.data)).catch(() => setStatus({ reachable: false }));
  }, []);

  useEffect(() => {
    sessionStorage.setItem('aridja_chat', JSON.stringify(messages.slice(-40)));
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const online = status?.reachable && status?.detail === 'ok';
  const statusLabel = !status
    ? 'Connecting…'
    : !status.reachable
    ? 'Unavailable'
    : status.detail === 'ok'
    ? (status.ai_ready ? 'Online' : 'Connected')
    : status.configured === false
    ? 'Not configured'
    : 'Unavailable';

  const send = async (text) => {
    const message = (text || input).trim();
    if (!message || sending) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text: message }]);
    setSending(true);
    try {
      const res = await axiosInstance.post('/aridja/chat', { message });
      const reply = res.data?.reply || res.data?.response || res.data?.message || res.data?.answer || JSON.stringify(res.data);
      setMessages((m) => [...m, { role: 'aridja', text: reply }]);
    } catch (e) {
      const detail = e?.response?.data?.detail || 'Aridja is unreachable right now.';
      setMessages((m) => [...m, { role: 'system', text: `${detail} — you can still open Aridja directly below.` }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1628] via-primary to-[#0a1628] pb-24 flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0a1628]/95 backdrop-blur-lg border-b border-white/10 px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-white/70 hover:text-white" data-testid="aridja-back">
            <ArrowLeft size={20} />
          </button>
          <div className="w-10 h-10 bg-gradient-to-br from-[#E8A817] to-yellow-600 rounded-xl flex items-center justify-center">
            <Gem className="text-[#0a1628]" size={20} />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-heading font-bold text-white">Aridja</h1>
            <p className="text-xs text-white/60">AI Net Worth Architect</p>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${
              online
                ? 'text-emerald-300 border-emerald-400/40 bg-emerald-400/10'
                : 'text-amber-300 border-amber-400/40 bg-amber-400/10'
            }`}
            data-testid="aridja-status-chip"
          >
            {online ? <Wifi size={12} /> : <WifiOff size={12} />}
            {statusLabel}
          </span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto w-full flex-1 flex flex-col p-4 gap-4">
        {/* Intro / hero card */}
        {messages.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl bg-gradient-to-br from-[#E8A817]/20 to-yellow-500/5 border border-[#E8A817]/30 p-6"
            data-testid="aridja-hero"
          >
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={16} className="text-[#E8A817]" />
              <p className="text-[11px] uppercase tracking-[0.25em] font-bold text-[#E8A817]">Partner intelligence</p>
            </div>
            <h2 className="text-2xl font-heading font-bold text-white mb-2">
              Understand, uncover, and build your net worth.
            </h2>
            <p className="text-sm text-white/70 mb-4">
              Aridja teaches you how money works, maps the relationships that compound it, and builds your
              blueprint for income-generating assets — right here inside Network Capital.
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-xs text-white/85 bg-white/10 hover:bg-white/15 border border-white/15 rounded-full px-3 py-1.5 transition-colors"
                  data-testid="aridja-suggestion"
                >
                  {s}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Chat thread */}
        <div className="flex-1 space-y-3" data-testid="aridja-thread">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-[#E8A817] text-[#0a1628] font-medium rounded-br-md'
                    : m.role === 'aridja'
                    ? 'bg-white/10 border border-white/10 text-white rounded-bl-md'
                    : 'bg-amber-400/10 border border-amber-400/30 text-amber-200 text-xs'
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="bg-white/10 border border-white/10 rounded-2xl rounded-bl-md px-4 py-3 flex gap-1.5">
                {[0, 1, 2].map((d) => (
                  <span
                    key={d}
                    className="w-2 h-2 rounded-full bg-[#E8A817]/80 animate-bounce"
                    style={{ animationDelay: `${d * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Open full Aridja */}
        <a
          href={ARIDJA_SITE}
          className="inline-flex items-center justify-center gap-2 text-xs text-white/60 hover:text-[#E8A817] transition-colors"
          data-testid="aridja-external-link"
        >
          Open the full Aridja experience <ExternalLink size={12} />
        </a>
      </div>

      {/* Composer */}
      <div className="fixed bottom-16 left-0 right-0 z-30 px-4">
        <div className="max-w-3xl mx-auto flex items-center gap-2 bg-[#0a1628]/95 backdrop-blur-lg border border-white/15 rounded-2xl p-2 shadow-2xl">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="Ask Aridja about building wealth…"
            className="flex-1 bg-transparent text-sm text-white placeholder-white/40 px-3 py-2 outline-none"
            data-testid="aridja-input"
          />
          <button
            onClick={() => send()}
            disabled={sending || !input.trim()}
            className="w-10 h-10 rounded-xl bg-[#E8A817] text-[#0a1628] flex items-center justify-center disabled:opacity-40 active:scale-95 transition-all"
            data-testid="aridja-send"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AridjaPage;
