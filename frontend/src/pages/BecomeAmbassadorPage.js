import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Star, ShieldCheck, AlertTriangle, ExternalLink, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { axiosInstance } from '../App';
import { toast } from 'sonner';

const STATUS_META = {
  pending: { tone: 'bg-amber-100 text-amber-700', icon: Clock, label: 'Pending review' },
  approved: { tone: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2, label: 'Approved' },
  rejected: { tone: 'bg-red-100 text-red-700', icon: XCircle, label: 'Not approved' },
};

const BecomeAmbassadorPage = ({ user }) => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [why, setWhy] = useState('');
  const [links, setLinks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try { const r = await axiosInstance.get('/ambassadors/me/application'); setData(r.data); }
    catch (e) { toast.error(e.response?.data?.detail || 'Could not load'); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (why.trim().length < 20) { toast.error('Tell us a bit more about why you\'d be a great ambassador (at least 20 characters).'); return; }
    setSubmitting(true);
    try {
      const linkArr = links.split('\n').map((l) => l.trim()).filter(Boolean);
      await axiosInstance.post('/ambassadors/apply', { why: why.trim(), links: linkArr });
      toast.success('Application submitted — we\'ll review it shortly.');
      setWhy(''); setLinks('');
      load();
    } catch (e) { toast.error(e.response?.data?.detail || 'Submission failed'); }
    setSubmitting(false);
  };

  if (loading || !data) return <div className="p-10 text-center text-text-muted" data-testid="become-ambassador-loading"><Loader2 className="mx-auto animate-spin" /></div>;

  const pendingApp = data.application && data.application.status === 'pending' ? data.application : null;
  const lastDecided = data.application && data.application.status !== 'pending' ? data.application : null;

  return (
    <div className="min-h-screen bg-background-DEFAULT pb-24" data-testid="become-ambassador-page">
      <div className="sticky top-0 z-10 bg-white/85 backdrop-blur-lg border-b border-gray-200 px-4 py-3 flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-gray-100"><ArrowLeft size={20} /></button>
        <h1 className="text-base font-heading font-bold text-primary flex-1 inline-flex items-center gap-2"><Star size={16} className="text-secondary" /> Become an Ambassador</h1>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Hero */}
        <div className="bg-gradient-to-br from-primary via-[#0f1d3a] to-[#0a1628] text-white rounded-3xl p-5">
          <Star size={28} className="text-secondary mb-2" />
          <h2 className="font-heading text-2xl font-bold leading-tight mb-1">Lead your community.</h2>
          <p className="text-sm opacity-85">Ambassadors are members who go above and beyond — recruiting newcomers, helping others thrive, and shaping the culture of Network Capital. You'll get a public ★ badge, leaderboard ranking, exclusive notifications, and recognition tiers.</p>
        </div>

        {data.is_ambassador ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center" data-testid="already-ambassador">
            <CheckCircle2 size={32} className="mx-auto text-emerald-600 mb-2" />
            <p className="font-bold text-emerald-900 mb-1">You're already an Ambassador</p>
            <p className="text-xs text-emerald-800 mb-3">Your ★ Ambassador badge is active across the platform.</p>
            <button onClick={() => navigate('/ambassadors/me')} className="bg-emerald-600 text-white font-bold px-4 py-2 rounded-full text-sm">View ambassador dashboard</button>
          </div>
        ) : pendingApp ? (
          <ApplicationStatus app={pendingApp} />
        ) : (
          <>
            {lastDecided && <ApplicationStatus app={lastDecided} />}

            {/* Eligibility gate */}
            <div className={`rounded-2xl p-4 border ${data.eligible ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`} data-testid="eligibility-card">
              <div className="flex items-start gap-2">
                {data.eligible ? <ShieldCheck size={18} className="text-emerald-600 mt-0.5 flex-shrink-0" /> : <AlertTriangle size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />}
                <div className="flex-1">
                  <p className="font-bold text-text-primary mb-1">{data.eligible ? 'You\'re eligible to apply' : `You need ${data.min_score_required} Network Score to apply`}</p>
                  <p className="text-xs text-text-secondary mb-2">Your current score: <strong>{data.score}</strong> · Minimum required: <strong>{data.min_score_required}</strong></p>
                  <div className="h-2 bg-white rounded-full overflow-hidden">
                    <div className={`h-full ${data.eligible ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${Math.min(100, (data.score / data.min_score_required) * 100)}%` }} />
                  </div>
                  {!data.eligible && (
                    <p className="text-[11px] text-text-muted mt-2">Keep contributing to grow your score — every post, comment, place review, referral and connection adds up.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Application form */}
            {data.eligible && (
              <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3" data-testid="application-form">
                <p className="text-[11px] uppercase tracking-wider font-bold text-text-muted">Your application</p>
                <div>
                  <label className="text-xs font-bold text-text-secondary block mb-1">Why do you want to be an ambassador?</label>
                  <textarea
                    value={why}
                    onChange={(e) => setWhy(e.target.value)}
                    rows={5}
                    maxLength={1500}
                    placeholder="What does the Network Capital community mean to you? How will you help it grow?"
                    className="w-full p-3 border border-gray-200 rounded-xl text-sm resize-none outline-none focus:border-primary"
                    data-testid="ambassador-why" />
                  <p className="text-[10px] text-text-muted text-right mt-1">{why.length} / 1500</p>
                </div>
                <div>
                  <label className="text-xs font-bold text-text-secondary block mb-1">Links (optional · one per line)</label>
                  <textarea
                    value={links}
                    onChange={(e) => setLinks(e.target.value)}
                    rows={3}
                    placeholder="Your LinkedIn, X, Instagram, website…"
                    className="w-full p-3 border border-gray-200 rounded-xl text-sm resize-none outline-none focus:border-primary"
                    data-testid="ambassador-links" />
                </div>
                <button onClick={submit} disabled={submitting} className="w-full bg-primary text-white font-bold py-2.5 rounded-full text-sm disabled:opacity-50 inline-flex items-center justify-center gap-1" data-testid="ambassador-submit">
                  {submitting && <Loader2 size={12} className="animate-spin" />}
                  Submit application
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const ApplicationStatus = ({ app }) => {
  const meta = STATUS_META[app.status] || STATUS_META.pending;
  const SI = meta.icon;
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4" data-testid={`application-status-${app.status}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${meta.tone}`}>
          <SI size={11} /> {meta.label}
        </span>
        <span className="text-[10px] text-text-muted ml-auto">{new Date(app.created_at).toLocaleDateString()}</span>
      </div>
      <p className="text-sm text-text-secondary">{app.why}</p>
      {app.admin_note && (
        <div className="mt-2 bg-background-subtle rounded-xl p-2 text-xs">
          <p className="font-bold text-text-muted text-[10px] uppercase tracking-wider">Reviewer note</p>
          <p className="text-text-secondary">{app.admin_note}</p>
        </div>
      )}
      {(app.links || []).length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {app.links.map((l, i) => (
            <a key={i} href={l} target="_blank" rel="noopener noreferrer" className="text-[11px] text-primary bg-primary/10 px-2 py-0.5 rounded-full inline-flex items-center gap-1 hover:underline"><ExternalLink size={9} /> {l}</a>
          ))}
        </div>
      )}
    </div>
  );
};

export default BecomeAmbassadorPage;
