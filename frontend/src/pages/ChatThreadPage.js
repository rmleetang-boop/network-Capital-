import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Send, Image as ImageIcon, Mic, Square, Play, Pause, X, AlertTriangle, Sparkles } from 'lucide-react';
import { axiosInstance } from '../App';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const MAX_BYTES = 3 * 1024 * 1024;

const timeStr = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const ChatThreadPage = ({ user }) => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const sharePostId = params.get('share_post');
  const [other, setOther] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [image, setImage] = useState(null);
  const [audio, setAudio] = useState(null);
  const [recording, setRecording] = useState(false);
  const [sending, setSending] = useState(false);
  const [flags, setFlags] = useState([]);
  const [confirmFlagged, setConfirmFlagged] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const scrollerRef = useRef(null);
  const sharedSentRef = useRef(new Set());

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const r = await axiosInstance.get(`/dm/threads/${userId}`);
        if (cancelled) return;
        setOther(r.data.other_user);
        setMessages(r.data.messages || []);
      } catch (e) {
        toast.error('Failed to load messages');
      }
    };
    load();
    const id = setInterval(load, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, [userId]);

  // auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [messages]);

  // live compliance scan
  useEffect(() => {
    if (!text.trim()) { setFlags([]); return; }
    const t = setTimeout(async () => {
      try {
        const r = await axiosInstance.post('/dm/compliance-check', { text });
        setFlags(r.data.flags || []);
      } catch {}
    }, 350);
    return () => clearTimeout(t);
  }, [text]);

  // Auto-send a shared post if ?share_post=<id> is present (fired once per id+user)
  useEffect(() => {
    if (!sharePostId) return;
    const key = `${userId}:${sharePostId}`;
    if (sharedSentRef.current.has(key)) return;
    sharedSentRef.current.add(key);
    const sendShared = async () => {
      try {
        const res = await axiosInstance.post('/dm/send', {
          recipient_id: userId,
          shared_post_id: sharePostId,
        });
        setMessages((prev) => [...prev, res.data.message]);
        toast.success('Post shared');
      } catch (e) {
        toast.error(e.response?.data?.detail || 'Failed to share post');
        sharedSentRef.current.delete(key); // allow retry on failure
      } finally {
        const next = new URLSearchParams(params);
        next.delete('share_post');
        setParams(next, { replace: true });
      }
    };
    sendShared();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharePostId, userId]);

  const handleImagePick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_BYTES) { toast.error('Image too large (max 3MB)'); return; }
    const r = new FileReader();
    r.onload = () => setImage(r.result);
    r.readAsDataURL(file);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (blob.size > MAX_BYTES) { toast.error('Voice note too long (max 3MB)'); return; }
        const reader = new FileReader();
        reader.onload = () => setAudio(reader.result);
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorderRef.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      toast.error('Microphone permission denied');
    }
  };

  const stopRecording = () => {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== 'inactive') rec.stop();
    setRecording(false);
  };

  const resetComposer = () => {
    setText(''); setImage(null); setAudio(null); setFlags([]); setConfirmFlagged(false);
  };

  const handleSend = async () => {
    const hasFlags = flags.length > 0;
    if (hasFlags && !confirmFlagged) {
      setConfirmFlagged(true);
      toast("Heads up — please review the highlighted words and tap Send again.", {
        description: flags.map(f => `"${f.word}" → "${f.suggestion}"`).join(' · '),
      });
      return;
    }
    if (!text.trim() && !image && !audio) {
      toast.error('Write something or attach media');
      return;
    }
    setSending(true);
    try {
      const res = await axiosInstance.post('/dm/send', {
        recipient_id: userId,
        text: text.trim(),
        image,
        audio,
      });
      setMessages((prev) => [...prev, res.data.message]);
      resetComposer();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  const meId = user.id;

  return (
    <div className="min-h-screen bg-background-DEFAULT flex flex-col" data-testid="chat-thread-page">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gradient-to-r from-[#0a1628] via-primary to-[#0a1628] border-b border-white/10 px-3 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate('/messages')} className="p-2 text-white/80 hover:text-white" data-testid="chat-back">
            <ArrowLeft size={20} />
          </button>
          {other && (
            <button
              onClick={() => navigate(`/profile/${other.id}`)}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
              data-testid="chat-header-profile"
            >
              <Avatar className="w-10 h-10">
                <AvatarImage src={other.photo} />
                <AvatarFallback>{(other.username || '?')[0].toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="text-left">
                <p className="text-white font-semibold text-sm leading-tight">{other.full_name || other.username}</p>
                <p className="text-[11px] text-white/60">@{other.username} · Score {other.network_score}</p>
              </div>
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollerRef} className="flex-1 overflow-y-auto max-w-2xl w-full mx-auto p-3 pb-32">
        {messages.length === 0 && (
          <p className="text-center text-text-muted text-sm py-10">
            Say hi to {other?.username || 'them'} — all communication must follow our compliance rules (no investing / returns / guaranteed language).
          </p>
        )}
        {messages.map((m, idx) => {
          const mine = m.sender_id === meId;
          const hasFlags = (m.compliance_warnings || []).length > 0;
          return (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${mine ? 'justify-end' : 'justify-start'} mb-2`}
              data-testid={`dm-msg-${idx}`}
            >
              <div className={`max-w-[75%] rounded-2xl px-3 py-2 ${mine ? 'bg-primary text-white rounded-br-sm' : 'bg-white text-text-primary border border-gray-100 rounded-bl-sm shadow-sm'}`}>
                {m.shared_post && (
                  <button
                    onClick={() => navigate(`/?post=${m.shared_post.id}`)}
                    className={`block w-full text-left mb-1 rounded-xl overflow-hidden ${mine ? 'bg-white/10' : 'bg-background-subtle'}`}
                    data-testid={`dm-shared-post-${idx}`}
                  >
                    {m.shared_post.image && <img src={m.shared_post.image} alt="" className="w-full max-h-48 object-cover" />}
                    <div className="p-2">
                      <p className={`text-[11px] font-semibold ${mine ? 'text-white/90' : 'text-primary'} flex items-center gap-1`}>
                        {m.shared_post.is_auto_narrated && <Sparkles size={10} />}
                        @{m.shared_post.username}
                      </p>
                      <p className={`text-xs line-clamp-2 ${mine ? 'text-white/80' : 'text-text-secondary'}`}>{m.shared_post.content}</p>
                    </div>
                  </button>
                )}
                {m.image && <img src={m.image} alt="" className="w-full max-h-80 object-cover rounded-xl mb-1" />}
                {m.audio && <audio controls src={m.audio} className="w-full mb-1" />}
                {m.text && <p className="text-sm whitespace-pre-wrap break-words">{m.text}</p>}
                {hasFlags && (
                  <div className={`mt-1 flex items-center gap-1 text-[10px] ${mine ? 'text-white/80' : 'text-yellow-700'}`}>
                    <AlertTriangle size={10} />
                    <span>{m.compliance_warnings.map(f => f.word).join(', ')}</span>
                  </div>
                )}
                <p className={`text-[10px] mt-0.5 ${mine ? 'text-white/60' : 'text-text-muted'} text-right`}>{timeStr(m.created_at)}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Composer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-3 py-2 z-40 shadow-lg" data-testid="dm-composer">
        <div className="max-w-2xl mx-auto">
          {/* Attachments preview */}
          <AnimatePresence>
            {(image || audio) && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex gap-2 mb-2">
                {image && (
                  <div className="relative">
                    <img src={image} alt="" className="w-20 h-20 object-cover rounded-lg" />
                    <button onClick={() => setImage(null)} className="absolute -top-1 -right-1 bg-white rounded-full p-1 shadow-md" data-testid="dm-remove-image"><X size={12} /></button>
                  </div>
                )}
                {audio && (
                  <div className="relative flex-1 bg-background-subtle rounded-lg p-2 flex items-center gap-2">
                    <audio controls src={audio} className="flex-1 h-8" />
                    <button onClick={() => setAudio(null)} className="bg-white rounded-full p-1 shadow-sm" data-testid="dm-remove-audio"><X size={12} /></button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Compliance live warning */}
          {flags.length > 0 && (
            <div className="mb-2 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-xl text-xs text-yellow-800 flex items-start gap-2" data-testid="compliance-warning">
              <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Blocked word{flags.length > 1 ? 's' : ''} detected:</p>
                {flags.map((f) => (
                  <p key={f.word}>"{f.word}" → try "{f.suggestion}"</p>
                ))}
                <p className="mt-1 italic">Tap Send again to send anyway.</p>
              </div>
            </div>
          )}

          <div className="flex items-end gap-2">
            <label className="p-2.5 rounded-full bg-background-subtle hover:bg-gray-200 cursor-pointer transition-colors" data-testid="dm-image-tile">
              <ImageIcon size={18} className="text-primary" />
              <input type="file" accept="image/*" onChange={handleImagePick} className="hidden" data-testid="dm-image-input" />
            </label>
            {recording ? (
              <button
                onClick={stopRecording}
                className="p-2.5 rounded-full bg-red-500 text-white animate-pulse"
                data-testid="dm-stop-recording"
              >
                <Square size={18} />
              </button>
            ) : (
              <button
                onClick={startRecording}
                className="p-2.5 rounded-full bg-background-subtle hover:bg-gray-200 transition-colors"
                data-testid="dm-start-recording"
                disabled={!!audio}
              >
                <Mic size={18} className="text-primary" />
              </button>
            )}
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={1}
              placeholder="Message"
              className={`flex-1 resize-none px-4 py-2 rounded-2xl border outline-none text-sm max-h-24 ${flags.length > 0 ? 'border-yellow-400 bg-yellow-50/30' : 'border-gray-200 focus:border-primary'}`}
              data-testid="dm-text-input"
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            />
            <button
              onClick={handleSend}
              disabled={sending || (!text.trim() && !image && !audio)}
              className="p-2.5 rounded-full bg-primary text-white disabled:opacity-40 active:scale-95 transition-all"
              data-testid="dm-send-button"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatThreadPage;
