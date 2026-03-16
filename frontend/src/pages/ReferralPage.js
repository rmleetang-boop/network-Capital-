import React from 'react';
import { motion } from 'framer-motion';
import { Copy, Share2, Users, Gift } from 'lucide-react';
import { toast } from 'sonner';
import NetworkScore from '../components/NetworkScore';

const ReferralPage = ({ user }) => {
  const referralUrl = `${window.location.origin}/join/${user.referral_code}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(referralUrl);
    toast.success('Referral link copied to clipboard!');
  };

  const shareVia = (platform) => {
    const text = `Join me on Network Capital and start building your network score!`;
    const url = encodeURIComponent(referralUrl);
    const encodedText = encodeURIComponent(text);

    const urls = {
      twitter: `https://twitter.com/intent/tweet?text=${encodedText}&url=${url}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
      whatsapp: `https://wa.me/?text=${encodedText}%20${url}`,
    };

    window.open(urls[platform], '_blank', 'width=600,height=400');
  };

  return (
    <div className="min-h-screen bg-background-DEFAULT">
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-lg border-b border-gray-200 px-4 py-4">
        <h1 className="text-2xl font-heading font-bold text-primary">Referrals</h1>
        <p className="text-sm text-text-secondary">Invite friends and earn +200 points</p>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-secondary to-primary rounded-2xl shadow-lg p-8 text-white text-center"
        >
          <div className="bg-white/20 backdrop-blur-sm rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
            <Gift size={40} />
          </div>
          <h2 className="text-3xl font-heading font-bold mb-2">Invite & Earn</h2>
          <p className="text-white/90 mb-4">
            Share your unique referral link and earn <span className="font-bold text-2xl">+200</span> points for each friend who joins!
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
        >
          <h3 className="font-heading font-bold text-text-primary mb-4 flex items-center gap-2">
            <Users size={20} />
            Your Referral Link
          </h3>

          <div className="bg-background-subtle rounded-xl p-4 mb-4 break-all font-mono text-sm text-text-primary">
            {referralUrl}
          </div>

          <button
            onClick={copyToClipboard}
            className="w-full bg-primary hover:bg-primary-hover text-white font-medium py-3 rounded-full shadow-md hover:shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
            data-testid="copy-referral-link"
          >
            <Copy size={20} />
            Copy Link
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
        >
          <h3 className="font-heading font-bold text-text-primary mb-4 flex items-center gap-2">
            <Share2 size={20} />
            Share Via
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => shareVia('twitter')}
              className="bg-[#1DA1F2] hover:bg-[#1a8cd8] text-white font-medium py-3 rounded-full transition-all shadow-md hover:shadow-lg active:scale-95"
              data-testid="share-twitter"
            >
              Twitter
            </button>
            <button
              onClick={() => shareVia('facebook')}
              className="bg-[#4267B2] hover:bg-[#365899] text-white font-medium py-3 rounded-full transition-all shadow-md hover:shadow-lg active:scale-95"
              data-testid="share-facebook"
            >
              Facebook
            </button>
            <button
              onClick={() => shareVia('linkedin')}
              className="bg-[#0077B5] hover:bg-[#006396] text-white font-medium py-3 rounded-full transition-all shadow-md hover:shadow-lg active:scale-95"
              data-testid="share-linkedin"
            >
              LinkedIn
            </button>
            <button
              onClick={() => shareVia('whatsapp')}
              className="bg-[#25D366] hover:bg-[#20bd5a] text-white font-medium py-3 rounded-full transition-all shadow-md hover:shadow-lg active:scale-95"
              data-testid="share-whatsapp"
            >
              WhatsApp
            </button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-br from-primary/10 to-secondary/10 rounded-2xl border border-primary/20 p-6"
        >
          <h3 className="font-heading font-bold text-text-primary mb-3">How It Works</h3>
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center font-bold text-sm">
                1
              </div>
              <div>
                <p className="text-sm text-text-primary font-medium">Share your link</p>
                <p className="text-xs text-text-secondary">Send your unique referral link to friends</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center font-bold text-sm">
                2
              </div>
              <div>
                <p className="text-sm text-text-primary font-medium">They sign up</p>
                <p className="text-xs text-text-secondary">Your friend creates an account using your link</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-secondary text-white rounded-full flex items-center justify-center font-bold text-sm">
                3
              </div>
              <div>
                <p className="text-sm text-text-primary font-medium">Earn rewards</p>
                <p className="text-xs text-text-secondary">Get +200 points instantly added to your score</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default ReferralPage;