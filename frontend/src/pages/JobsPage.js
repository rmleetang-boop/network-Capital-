import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, Plus, Search, MapPin, DollarSign, Lock, Loader2, Inbox, Users as UsersIcon } from 'lucide-react';
import { axiosInstance } from '../App';
import { toast } from 'sonner';
import FeatureIntroModal from '../components/FeatureIntroModal';

const TABS = [
  { key: 'browse', label: 'Browse jobs', icon: Search },
  { key: 'mine',   label: 'My postings', icon: Briefcase },
  { key: 'applications', label: 'My applications', icon: Inbox },
];

const JobsPage = ({ user }) => {
  const navigate = useNavigate();
  const [tab, setTab] = useState('browse');
  const [q, setQ] = useState('');
  const [jobs, setJobs] = useState([]);
  const [mine, setMine] = useState([]);
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unlocking, setUnlocking] = useState(false);

  // Stripe redirect handling — poll for unlock confirmation
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('checkout_status');
    const sid = params.get('session_id');
    if (status === 'success' && sid) {
      (async () => {
        try {
          for (let i = 0; i < 10; i++) {
            const r = await axiosInstance.get(`/jobs/checkout/status/${sid}`);
            if (r.data?.payment_status === 'paid') {
              toast.success('Job posting unlocked! 🎉');
              window.history.replaceState({}, '', '/jobs');
              window.location.reload();
              return;
            }
            await new Promise((res) => setTimeout(res, 2000));
          }
          toast.error('Payment is taking longer than expected. Refresh in a minute.');
        } catch (e) {
          toast.error('Could not confirm payment.');
        }
      })();
    } else if (status === 'cancel') {
      toast.error('Checkout cancelled.');
      window.history.replaceState({}, '', '/jobs');
    }
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      if (tab === 'browse') {
        const r = await axiosInstance.get(`/jobs${q ? `?q=${encodeURIComponent(q)}` : ''}`);
        setJobs(r.data || []);
      } else if (tab === 'mine') {
        const r = await axiosInstance.get('/jobs/me/posted');
        setMine(r.data || []);
      } else if (tab === 'applications') {
        const r = await axiosInstance.get('/jobs/me/applied');
        setApps(r.data || []);
      }
    } catch (e) {
      toast.error('Could not load jobs');
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [tab]);

  const startEmployerUnlock = async () => {
    if (unlocking) return;
    setUnlocking(true);
    try {
      const r = await axiosInstance.post('/jobs/checkout');
      window.location.href = r.data.url;
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not start checkout');
      setUnlocking(false);
    }
  };

  const handlePost = () => {
    if (user?.job_post_unlocked) navigate('/jobs/new');
    else startEmployerUnlock();
  };

  return (
    <div className="min-h-screen bg-background-DEFAULT pb-24" data-testid="jobs-page">
      <FeatureIntroModal
        featureKey="jobs"
        icon={<Briefcase size={20} />}
        title="Jobs on Network Capital"
        subtitle="Two roles, one place: post a job as an employer, or browse & apply as an employee."
        bullets={[
          { icon: <Search size={14} />, label: 'Browse open roles', body: 'Filter by location & keyword. Apply with a CV in PDF or Word.' },
          { icon: <Briefcase size={14} />, label: 'Post a job ($50 once)', body: 'Pay once to unlock job postings — list as many roles as you need from then on.' },
          { icon: <Inbox size={14} />, label: 'Track applications', body: 'See every role you applied to and the employer\'s decision in My Applications.' },
        ]}
      />

      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/85 backdrop-blur-lg border-b border-gray-200">
        <div className="px-4 pt-4 pb-3 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-heading font-bold text-primary">Jobs</h1>
            <p className="text-xs text-text-secondary">Hire or get hired in the Network Capital community.</p>
          </div>
          <button
            onClick={handlePost}
            className="bg-primary hover:bg-primary-hover text-white font-semibold rounded-full px-4 py-2 text-sm flex items-center gap-1.5"
            data-testid="post-job-button"
          >
            {user?.job_post_unlocked ? <Plus size={16} /> : <Lock size={14} />}
            {user?.job_post_unlocked ? 'Post' : `Unlock $50`}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 pb-2 overflow-x-auto" data-testid="jobs-tabs">
          {TABS.map(({ key, label, icon: Icon }) => {
            const active = tab === key;
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
                  active ? 'bg-primary text-white shadow-sm' : 'bg-gray-100 text-text-secondary hover:bg-gray-200'
                }`}
                data-testid={`jobs-tab-${key}`}
              >
                <Icon size={13} /> {label}
              </button>
            );
          })}
        </div>

        {/* Search bar (browse only) */}
        {tab === 'browse' && (
          <div className="px-4 pb-3">
            <form onSubmit={(e) => { e.preventDefault(); load(); }} className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
              <input
                value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="Search by title, company, or skill"
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-primary"
                data-testid="jobs-search-input"
              />
            </form>
          </div>
        )}
      </div>

      <div className="max-w-3xl mx-auto p-4 space-y-3">
        {loading && (
          <div className="text-center py-12 text-text-muted"><Loader2 className="animate-spin mx-auto" /></div>
        )}

        {!loading && tab === 'browse' && jobs.length === 0 && (
          <p className="text-center text-text-muted py-12">No open jobs match your search.</p>
        )}
        {!loading && tab === 'browse' && jobs.map((j) => (
          <JobRow key={j.id} job={j} onClick={() => navigate(`/jobs/${j.id}`)} />
        ))}

        {!loading && tab === 'mine' && (
          mine.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
              <Briefcase className="mx-auto text-text-muted mb-3" />
              <p className="text-text-secondary">You haven't posted any jobs yet.</p>
              <button
                onClick={handlePost}
                className="mt-3 bg-primary text-white px-5 py-2 rounded-full text-sm font-semibold"
                data-testid="post-first-job-button"
              >
                {user?.job_post_unlocked ? 'Post your first job' : `Unlock job posting · $50`}
              </button>
            </div>
          ) : mine.map((j) => (
            <JobRow key={j.id} job={j} showStatus showApplicants onClick={() => navigate(`/jobs/${j.id}`)} />
          ))
        )}

        {!loading && tab === 'applications' && (
          apps.length === 0 ? (
            <p className="text-center text-text-muted py-12">You haven't applied to any jobs yet.</p>
          ) : apps.map((a) => (
            <div key={a.id} className="bg-white rounded-2xl border border-gray-100 p-4 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => a.job?.id && navigate(`/jobs/${a.job.id}`)}
              data-testid={`application-row-${a.id}`}>
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="font-semibold text-text-primary truncate">{a.job?.title || 'Job (deleted)'}</p>
                <StatusBadge status={a.status} />
              </div>
              <p className="text-xs text-text-secondary truncate">{a.job?.company} · {a.job?.location}</p>
              <p className="text-[11px] text-text-muted mt-1">Applied {new Date(a.created_at).toLocaleDateString()}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const JobRow = ({ job, onClick, showStatus, showApplicants }) => (
  <div
    role="button"
    tabIndex={0}
    onClick={onClick}
    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick && onClick(); } }}
    className="bg-white rounded-2xl border border-gray-100 p-4 cursor-pointer hover:shadow-md transition-shadow animate-fade-in"
    data-testid={`job-row-${job.id}`}>
    <div className="flex items-start justify-between gap-2">
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-text-primary truncate" data-testid={`job-title-${job.id}`}>{job.title}</p>
        <p className="text-xs text-text-secondary truncate">{job.company}</p>
      </div>
      {showStatus && <StatusBadge status={job.status} />}
    </div>
    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-text-secondary">
      <span className="inline-flex items-center gap-1"><MapPin size={11} />{job.location}</span>
      {job.salary && <span className="inline-flex items-center gap-1"><DollarSign size={11} />{job.salary}</span>}
      {job.employment_type && <span className="px-1.5 py-0.5 bg-secondary/15 text-[#7a4f00] rounded-full text-[10px] font-semibold">{job.employment_type}</span>}
      {showApplicants && (
        <span className="inline-flex items-center gap-1 text-primary font-semibold">
          <UsersIcon size={11} /> {job.applications_count || 0} applicant{(job.applications_count || 0) === 1 ? '' : 's'}
        </span>
      )}
    </div>
  </div>
);

const StatusBadge = ({ status }) => {
  const map = {
    new:        { c: 'bg-blue-100 text-blue-700', l: 'New' },
    shortlisted:{ c: 'bg-amber-100 text-amber-700', l: 'Shortlisted' },
    interview:  { c: 'bg-purple-100 text-purple-700', l: 'Interview' },
    rejected:   { c: 'bg-gray-100 text-gray-700', l: 'Rejected' },
    hired:      { c: 'bg-green-100 text-green-700', l: 'Hired' },
    open:       { c: 'bg-green-100 text-green-700', l: 'Open' },
    closed:     { c: 'bg-gray-100 text-gray-700', l: 'Closed' },
  };
  const v = map[status] || { c: 'bg-gray-100 text-gray-700', l: status };
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${v.c}`}>{v.l}</span>;
};

export default JobsPage;
