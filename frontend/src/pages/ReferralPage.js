import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Copy, Share2, Users, Gift, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';

const ReferralPage = ({ user }) => {
  // Personalised referral link — built automatically from the user's canonical referral_code.
  // The code itself is auto-created at signup; users don't need to learn how it works.
  const { referralUrl, referralCode } = useMemo(() => {
    const origin = window.location.origin;
    const code = (user?.referral_code || (user?.id ? user.id.substring(0, 8) : 'member')).toUpperCase();
    const created = user?.created_at ? new Date(user.created_at) : new Date();
    const joined = isNaN(created.getTime()) ? new Date() : created;
    const yyyy = joined.getUTCFullYear();
    const mm = String(joined.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(joined.getUTCDate()).padStart(2, '0');
    const params = new URLSearchParams({ ref: code, joined: `${yyyy}-${mm}-${dd}` });
    const bm = user?.birth_month;
    if (bm && Number(bm) >= 1 && Number(bm) <= 12) params.set('bm', String(bm));
    return {
      referralUrl: `${origin}/join?${params.toString()}`,
      referralCode: code,
    };
  }, [user?.referral_code, user?.id, user?.created_at, user?.birth_month]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(referralUrl);
    toast.success('Referral link copied — share it with your circle!');
  };

  const shareVia = (platform) => {
    const text = `Join me on Network Capital — a community ecosystem where your participation builds shared access. Sign up with my link:`;
    const url = encodeURIComponent(referralUrl);
    const encodedText = encodeURIComponent(text);
    const urls = {
      twitter: `https://twitter.com/intent/tweet?text=${encodedText}&url=${url}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
      whatsapp: `https://wa.me/?text=${encodedText}%20${url}`,
      sms: `sms:?body=${encodedText}%20${url}`,
    };
    if (platform === 'sms') {
      window.location.href = urls.sms;
    } else {
      window.open(urls[platform], '_blank', 'width=600,height=400');
    }
  };

  return (
    <div className="min-h-screen bg-background-DEFAULT">
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-lg border-b border-gray-200 px-4 py-4">
        <h1 className="text-2xl font-heading font-bold text-primary">Referrals</h1>
        <p className="text-sm text-text-secondary">Invite friends and grow your Network Score.</p>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-6">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-primary via-[#0a1628] to-primary rounded-2xl shadow-lg p-7 text-white text-center border border-secondary/20"
          data-testid="referral-hero"
        >
          <div className="bg-secondary/20 backdrop-blur-sm rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 border border-secondary/40">
            <Gift size={30} className="text-secondary" />
          </div>
          <h2 className="text-2xl font-heading font-bold mb-2">Invite your circle</h2>
          <p className="text-white/80 mb-3 leading-relaxed">
            Earn <span className="font-bold text-secondary">+200 points</span> for every friend who joins.
          </p>

          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20" data-testid="referral-code-display">
            <span className="text-[10px] uppercase tracking-[0.18em] text-white/50 font-semibold">Your code</span>
            <span className="font-mono font-bold text-secondary tracking-wider text-sm">{referralCode}</span>
          </div>
        </motion.div>

        {/* Personal link card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
        >
          <h3 className="font-heading font-bold text-text-primary mb-4 flex items-center gap-2">
            <Users size={20} className="text-primary" />
            Your personal link
          </h3>

          <div className="bg-background-subtle rounded-xl p-4 mb-4 break-all font-mono text-xs text-text-primary border border-gray-200" data-testid="referral-link-display">
            {referralUrl}
          </div>

          <button
            onClick={copyToClipboard}
            className="w-full bg-primary hover:bg-primary-hover text-white font-medium py-3 rounded-full shadow-md hover:shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
            data-testid="copy-referral-link"
          >
            <Copy size={18} />
            Copy Link
          </button>
        </motion.div>

        {/* Share via */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
        >
          <h3 className="font-heading font-bold text-text-primary mb-4 flex items-center gap-2">
            <Share2 size={20} className="text-primary" />
            Share via
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => shareVia('whatsapp')}
              className="bg-[#25D366] hover:bg-[#20bd5a] text-white font-medium py-3 rounded-full transition-all shadow-md hover:shadow-lg active:scale-95 flex items-center justify-center gap-2"
              data-testid="share-whatsapp"
            >
              <MessageCircle size={16} /> WhatsApp
            </button>
            <button
              onClick={() => shareVia('sms')}
              className="bg-primary hover:bg-primary-hover text-white font-medium py-3 rounded-full transition-all shadow-md hover:shadow-lg active:scale-95 flex items-center justify-center gap-2"
              data-testid="share-sms"
            >
              <MessageCircle size={16} /> SMS
            </button>
            <button
              onClick={() => shareVia('twitter')}
              className="bg-black hover:bg-gray-800 text-white font-medium py-3 rounded-full transition-all shadow-md hover:shadow-lg active:scale-95"
              data-testid="share-twitter"
            >
              X (Twitter)
            </button>
            <button
              onClick={() => shareVia('linkedin')}
              className="bg-[#0077B5] hover:bg-[#006396] text-white font-medium py-3 rounded-full transition-all shadow-md hover:shadow-lg active:scale-95"
              data-testid="share-linkedin"
            >
              LinkedIn
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default ReferralPage;
