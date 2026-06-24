import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Share2, X, Copy, Check, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

// Lightweight platform icons using Simple Icons SVGs inline (no extra deps)
const TwitterIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);
const FacebookIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z" />
  </svg>
);
const WhatsAppIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
  </svg>
);
const LinkedInIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.063 2.063 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
);
const TelegramIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
  </svg>
);

const ShareMenu = ({ post, onShared, onClose }) => {
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();
  // Iter 56b — share URL always points at the production brand domain so the
  // visible URL in WhatsApp/Twitter previews is networkcapitalapp.co.za rather
  // than the preview/cluster pod hostname.
  const backend = 'https://networkcapitalapp.co.za';
  const postUrl = `${backend}/api/share/post/${post.id}`;
  const text = post.content?.slice(0, 200) || 'Check out this post on Network Capital';
  const encoded = encodeURIComponent(text);
  const encodedUrl = encodeURIComponent(postUrl);

  const platforms = [
    {
      name: 'Twitter / X',
      Icon: TwitterIcon,
      color: 'bg-black hover:bg-neutral-800',
      url: `https://twitter.com/intent/tweet?text=${encoded}&url=${encodedUrl}`,
    },
    {
      name: 'Facebook',
      Icon: FacebookIcon,
      color: 'bg-[#1877F2] hover:bg-[#166fe5]',
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encoded}`,
    },
    {
      name: 'WhatsApp',
      Icon: WhatsAppIcon,
      color: 'bg-[#25D366] hover:bg-[#1fb855]',
      url: `https://wa.me/?text=${encoded}%20${encodedUrl}`,
    },
    {
      name: 'LinkedIn',
      Icon: LinkedInIcon,
      color: 'bg-[#0A66C2] hover:bg-[#0959a8]',
      url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    },
    {
      name: 'Telegram',
      Icon: TelegramIcon,
      color: 'bg-[#26A5E4] hover:bg-[#2394cc]',
      url: `https://t.me/share/url?url=${encodedUrl}&text=${encoded}`,
    },
  ];

  const handleOpen = (url) => {
    window.open(url, '_blank', 'noopener,width=600,height=600');
    if (onShared) onShared();
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(postUrl);
    setCopied(true);
    toast.success('Link copied');
    setTimeout(() => setCopied(false), 1500);
    if (onShared) onShared();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        data-testid="share-menu"
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-heading font-bold flex items-center gap-2">
            <Share2 size={20} /> Share this post
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded" data-testid="share-menu-close">
            <X size={20} />
          </button>
        </div>

        <div className="grid grid-cols-5 gap-3 mb-5">
          {platforms.map((p) => (
            <button
              key={p.name}
              onClick={() => handleOpen(p.url)}
              className="flex flex-col items-center gap-1.5 hover:scale-105 transition-transform"
              data-testid={`share-${p.name.toLowerCase().split(' ')[0]}`}
              aria-label={`Share on ${p.name}`}
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white ${p.color}`}>
                <p.Icon width={22} height={22} />
              </div>
              <span className="text-[10px] text-text-secondary text-center leading-tight">
                {p.name.split(' ')[0]}
              </span>
            </button>
          ))}
        </div>

        <button
          onClick={() => { onShared && onShared(); onClose(); navigate(`/messages?share_post=${post.id}`); }}
          className="w-full mb-2 py-3 bg-primary hover:bg-primary-hover text-white rounded-full flex items-center justify-center gap-2 font-semibold transition-all active:scale-95"
          data-testid="share-send-dm"
        >
          <MessageCircle size={16} /> Send in a DM
        </button>

        <button
          onClick={handleCopy}
          className="w-full py-3 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center gap-2 text-text-primary font-medium transition-all"
          data-testid="share-copy-link"
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? 'Copied!' : 'Copy link'}
        </button>
      </motion.div>
    </div>
  );
};

export default ShareMenu;
