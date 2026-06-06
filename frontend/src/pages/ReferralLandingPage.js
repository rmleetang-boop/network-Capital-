import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { Crown, Loader2, Sparkles, Users, ArrowRight, ShieldCheck } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

/** Public referral landing page mounted at /r/:username.
 *  Renders a polished invite card from the referrer's profile, stamps the
 *  referral attribution in localStorage so the standard signup flow picks
 *  it up, and CTAs into /auth.
 */
const ReferralLandingPage = () => {
  const { username } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!username) return;
    axios.get(`${API}/api/referral/${encodeURIComponent(username)}`)
      .then((r) => {
        setData(r.data);
        // Persist referral attribution so the signup endpoint picks it up
        try {
          localStorage.setItem('nc_referrer', JSON.stringify({
            id: r.data.referrer_id,
            username: r.data.username,
            at: new Date().toISOString(),
          }));
        } catch { /* storage disabled */ }
      })
      .catch((e) => setErr(e.response?.data?.detail || 'Invite link not found'));
  }, [username]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#04101e] via-[#0a1f3a] to-[#04101e] text-white" data-testid="referral-landing-page">
      <header className="px-6 py-5 flex items-center justify-between max-w-5xl mx-auto">
        <Link to="/" className="font-heading font-bold tracking-wider text-sm sm:text-base">
          NETWORK <span className="text-secondary">CAPITAL</span>
        </Link>
        <Link to="/auth" className="text-xs sm:text-sm font-bold bg-secondary text-primary px-4 py-2 rounded-full hover:opacity-95">
          Sign in
        </Link>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12 sm:py-20">
        {err ? (
          <div className="text-center py-20" data-testid="referral-error">
            <p className="text-xl font-heading font-bold mb-2">Invite not found</p>
            <p className="text-sm text-white/60 mb-6">{err}</p>
            <button onClick={() => navigate('/')} className="bg-secondary text-primary text-sm font-bold px-5 py-2.5 rounded-full">
              Go home
            </button>
          </div>
        ) : !data ? (
          <div className="py-20 text-center text-white/55"><Loader2 className="mx-auto animate-spin" /></div>
        ) : (
          <>
            <div className="text-center mb-8">
              <p className="text-[11px] font-bold tracking-[0.3em] text-secondary mb-3">YOU&apos;VE BEEN INVITED</p>
              <h1 className="font-heading font-bold text-3xl sm:text-5xl leading-tight">
                Join {data.full_name?.split(' ')[0] || data.username} on<br />
                <span className="text-secondary">Network Capital</span>
              </h1>
            </div>

            <div className="bg-white/[0.04] border border-white/10 rounded-3xl p-6 sm:p-8 mb-6 backdrop-blur-sm" data-testid="referral-card">
              <div className="flex items-center gap-4 mb-5">
                {data.photo ? (
                  <img src={data.photo} alt="" className="w-16 h-16 rounded-full object-cover border-2 border-secondary/40" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-secondary to-primary flex items-center justify-center text-2xl font-bold">
                    {(data.full_name || data.username || '?')[0].toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-heading font-bold text-lg sm:text-xl flex items-center gap-2">
                    {data.full_name}
                    {data.is_ambassador && <Crown size={14} className="text-secondary fill-secondary" />}
                  </p>
                  <p className="text-xs text-white/55">@{data.username} · {data.network_score?.toLocaleString?.() || 0} Network Score</p>
                </div>
              </div>
              <p className="text-sm text-white/80 leading-relaxed mb-6">
                Network Capital is Africa&apos;s community resource ecosystem — build your Network Score,
                join savings circles (Stokvel+), find opportunities, and grow alongside people who
                back each other. {data.full_name?.split(' ')[0] || 'They'} thinks you&apos;ll fit in.
              </p>
              <button
                onClick={() => navigate('/auth?signup=1')}
                className="w-full bg-secondary text-primary font-bold py-3.5 rounded-full inline-flex items-center justify-center gap-2 hover:opacity-95"
                data-testid="referral-cta"
              >
                Create my account <ArrowRight size={16} />
              </button>
              <p className="text-[11px] text-white/40 text-center mt-3">
                Free to join · POPIA-aligned · Not a financial service
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat icon={Users} title="Connect" body="Meaningful relationships" />
              <Stat icon={Sparkles} title="Earn" body="Score from real activity" />
              <Stat icon={ShieldCheck} title="Protected" body="POPIA compliant" />
            </div>
          </>
        )}
      </main>
    </div>
  );
};

const Stat = ({ icon: Icon, title, body }) => (
  <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
    <Icon size={16} className="mx-auto text-secondary mb-1.5" />
    <p className="text-xs font-bold">{title}</p>
    <p className="text-[10px] text-white/55 leading-tight mt-0.5">{body}</p>
  </div>
);

export default ReferralLandingPage;
