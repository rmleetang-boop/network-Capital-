import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, MapPin, DollarSign, Briefcase, Mail, FileText, Send, Loader2, Star, Users, Trash2, X, Check } from 'lucide-react';
import { axiosInstance } from '../App';
import { toast } from 'sonner';

const STATUSES = ['new', 'shortlisted', 'interview', 'rejected', 'hired'];

const JobDetailPage = ({ user }) => {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [showApply, setShowApply] = useState(false);
  const [showApplicants, setShowApplicants] = useState(false);
  const [applicants, setApplicants] = useState([]);
  const [loadingApplicants, setLoadingApplicants] = useState(false);

  const isOwner = job && user && job.employer_id === user.id;
  const meetsScore = job ? (Number(user?.network_score || 0) >= Number(job.min_network_score || 0)) : true;

  useEffect(() => {
    axiosInstance.get(`/jobs/${jobId}`)
      .then((r) => setJob(r.data))
      .catch(() => toast.error('Job not found'));
  }, [jobId]);

  const loadApplicants = async () => {
    setLoadingApplicants(true);
    try {
      const r = await axiosInstance.get(`/jobs/${jobId}/applications`);
      setApplicants(r.data || []);
      setShowApplicants(true);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not load applicants');
    } finally {
      setLoadingApplicants(false);
    }
  };

  const closeJob = async () => {
    if (!window.confirm('Close this job? It will no longer accept applications.')) return;
    try {
      await axiosInstance.patch(`/jobs/${jobId}`, { status: job.status === 'open' ? 'closed' : 'open' });
      const r = await axiosInstance.get(`/jobs/${jobId}`);
      setJob(r.data);
      toast.success(r.data.status === 'open' ? 'Re-opened.' : 'Job closed.');
    } catch (e) {
      toast.error('Could not update job');
    }
  };

  const deleteJob = async () => {
    if (!window.confirm('Delete this posting? Applications will also be removed.')) return;
    try {
      await axiosInstance.delete(`/jobs/${jobId}`);
      toast.success('Job deleted');
      navigate('/jobs');
    } catch (e) {
      toast.error('Could not delete job');
    }
  };

  if (!job) return <div className="p-8 text-center text-text-muted"><Loader2 className="mx-auto animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-background-DEFAULT pb-24" data-testid="job-detail-page">
      <div className="sticky top-0 z-10 bg-white/85 backdrop-blur-lg border-b border-gray-200 px-4 py-3 flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-gray-100" data-testid="job-back">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-base font-heading font-bold text-primary truncate flex-1">{job.title}</h1>
      </div>

      <div className="max-w-3xl mx-auto p-4 space-y-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-primary via-[#0a1628] to-primary text-white rounded-2xl p-6 border border-secondary/20">
          <p className="text-secondary text-xs uppercase tracking-[0.18em] font-semibold mb-1">{job.employment_type}</p>
          <h2 className="font-heading font-bold text-2xl mb-1">{job.title}</h2>
          <p className="text-white/80">{job.company}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-sm text-white/75">
            <span className="inline-flex items-center gap-1"><MapPin size={13} />{job.location}</span>
            {job.salary && <span className="inline-flex items-center gap-1"><DollarSign size={13} />{job.salary}</span>}
          </div>
          {Number(job.min_network_score || 0) > 0 && (
            <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/15 text-secondary text-xs font-semibold border border-secondary/30">
              <Star size={11} /> Min. Network Score: {Number(job.min_network_score).toLocaleString()}
            </div>
          )}
        </motion.div>

        <Section title="About the role">
          <p className="whitespace-pre-wrap text-sm text-text-primary leading-relaxed">{job.description}</p>
        </Section>

        {Array.isArray(job.responsibilities) && job.responsibilities.length > 0 && (
          <Section title="Key responsibilities"><BulletList items={job.responsibilities} /></Section>
        )}
        {Array.isArray(job.requirements) && job.requirements.length > 0 && (
          <Section title="Requirements"><BulletList items={job.requirements} /></Section>
        )}
        {Array.isArray(job.skills) && job.skills.length > 0 && (
          <Section title="Skills">
            <div className="flex flex-wrap gap-1.5">
              {job.skills.map((s, i) => (
                <span key={i} className="px-2.5 py-1 bg-primary/8 text-primary text-xs font-semibold rounded-full border border-primary/15">{s}</span>
              ))}
            </div>
          </Section>
        )}
        {Array.isArray(job.application_steps) && job.application_steps.length > 0 && (
          <Section title="How to apply"><BulletList items={job.application_steps} ordered /></Section>
        )}
        {job.contact_email && (
          <Section title="Contact">
            <a href={`mailto:${job.contact_email}`} className="text-primary inline-flex items-center gap-1.5 text-sm font-semibold">
              <Mail size={14} /> {job.contact_email}
            </a>
          </Section>
        )}

        {/* Apply / employer actions */}
        {!isOwner && job.status === 'open' && (
          <button
            onClick={() => meetsScore ? setShowApply(true) : toast.error(`This role requires a Network Score of ${Number(job.min_network_score).toLocaleString()}. You have ${Number(user?.network_score || 0).toLocaleString()}.`)}
            className="w-full bg-secondary text-primary font-bold py-3.5 rounded-full hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-md"
            data-testid="apply-button"
          >
            <Send size={18} /> Apply for this job
          </button>
        )}
        {!isOwner && job.status !== 'open' && (
          <p className="text-center text-text-muted text-sm py-4">This job is no longer accepting applications.</p>
        )}

        {isOwner && (
          <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-2" data-testid="employer-controls">
            <button
              onClick={loadApplicants}
              className="w-full bg-primary text-white font-semibold py-2.5 rounded-full hover:bg-primary-hover flex items-center justify-center gap-2"
              data-testid="view-applicants-button"
            >
              {loadingApplicants ? <Loader2 size={16} className="animate-spin" /> : <Users size={16} />}
              View applicants ({job.applications_count || 0})
            </button>
            <div className="flex gap-2">
              <button onClick={closeJob} className="flex-1 border border-gray-200 text-text-primary py-2.5 rounded-full text-sm font-semibold hover:bg-gray-50">
                {job.status === 'open' ? 'Close job' : 'Re-open job'}
              </button>
              <button onClick={deleteJob} className="flex-1 border border-red-200 text-red-600 py-2.5 rounded-full text-sm font-semibold hover:bg-red-50 flex items-center justify-center gap-1.5">
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>
        )}
      </div>

      {showApply && <ApplyModal jobId={jobId} onClose={() => setShowApply(false)} onApplied={() => { setShowApply(false); toast.success('Application submitted!'); }} />}
      {showApplicants && <ApplicantsModal job={job} applicants={applicants} setApplicants={setApplicants} onClose={() => setShowApplicants(false)} />}
    </div>
  );
};

const Section = ({ title, children }) => (
  <div className="bg-white rounded-2xl border border-gray-100 p-5">
    <h3 className="font-heading font-bold text-primary mb-2">{title}</h3>
    {children}
  </div>
);

const BulletList = ({ items, ordered }) => (
  <ul className="space-y-1.5">
    {items.map((it, i) => (
      <li key={i} className="text-sm text-text-primary flex gap-2">
        <span className="text-secondary font-bold flex-shrink-0">{ordered ? `${i + 1}.` : '•'}</span>
        <span className="leading-relaxed">{it}</span>
      </li>
    ))}
  </ul>
);

const ApplyModal = ({ jobId, onClose, onApplied }) => {
  const [file, setFile] = useState(null);
  const [coverNote, setCoverNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onPick = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const ok = /\.(pdf|doc|docx)$/i.test(f.name);
    if (!ok) return toast.error('Please upload a PDF or Word file (.pdf / .doc / .docx).');
    if (f.size > 5 * 1024 * 1024) return toast.error('CV is too large. Max 5MB.');
    setFile(f);
  };

  const submit = async () => {
    if (!file) return toast.error('Please upload your CV.');
    setSubmitting(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          await axiosInstance.post(`/jobs/${jobId}/apply`, {
            cv_filename: file.name,
            cv_data_url: reader.result,
            cover_note: coverNote.trim(),
          });
          onApplied();
        } catch (e) {
          toast.error(e.response?.data?.detail || 'Could not submit application');
        } finally {
          setSubmitting(false);
        }
      };
      reader.onerror = () => { setSubmitting(false); toast.error('Could not read file.'); };
      reader.readAsDataURL(file);
    } catch (e) {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => !submitting && onClose()} data-testid="apply-modal">
      <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
        <div className="px-6 pt-6 pb-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-heading font-bold text-lg">Apply for this job</h3>
          <button onClick={onClose} disabled={submitting} className="p-1.5 rounded-full hover:bg-gray-100"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">CV (PDF or Word) *</label>
            <label className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-primary">
              <FileText size={18} className="text-primary" />
              <span className="text-sm flex-1 truncate">{file ? file.name : 'Tap to choose your CV'}</span>
              <input type="file" accept=".pdf,.doc,.docx" onChange={onPick} className="hidden" data-testid="cv-file-input" />
            </label>
            <p className="text-[11px] text-text-muted mt-1">Max 5MB · .pdf / .doc / .docx</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Cover note (optional)</label>
            <textarea
              value={coverNote} onChange={(e) => setCoverNote(e.target.value)}
              rows={3} maxLength={2000}
              placeholder="A short note about why you'd be a great fit"
              className="w-full p-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary"
              data-testid="cover-note-input"
            />
          </div>
          <button
            onClick={submit}
            disabled={submitting || !file}
            className="w-full bg-secondary text-primary font-bold py-3 rounded-full hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-2"
            data-testid="submit-application-button"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            Submit application
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const ApplicantsModal = ({ job, applicants, setApplicants, onClose }) => {
  const updateStatus = async (appId, status) => {
    try {
      const r = await axiosInstance.patch(`/jobs/${job.id}/applications/${appId}`, { status });
      setApplicants((prev) => prev.map((a) => (a.id === appId ? r.data : a)));
      toast.success(`Marked ${status}.`);
    } catch (e) {
      toast.error('Could not update status');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-2xl max-h-[85vh] overflow-y-auto bg-white rounded-3xl shadow-2xl">
        <div className="sticky top-0 bg-white px-6 pt-6 pb-3 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="font-heading font-bold text-lg">{applicants.length} applicants</h3>
            <p className="text-xs text-text-secondary">{job.title}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100"><X size={18} /></button>
        </div>
        <div className="p-4 space-y-3">
          {applicants.length === 0 && <p className="text-text-muted text-center py-8">No applications yet.</p>}
          {applicants.map((a) => (
            <div key={a.id} className="border border-gray-100 rounded-xl p-3" data-testid={`applicant-${a.id}`}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-text-primary truncate">{a.applicant_full_name || `@${a.applicant_username}`}</p>
                  <p className="text-xs text-text-secondary">@{a.applicant_username} · Network Score {Number(a.applicant_network_score || 0).toLocaleString()}</p>
                </div>
                <span className="text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-gray-100 text-text-secondary">{a.status}</span>
              </div>
              {a.cover_note && <p className="text-sm text-text-primary mb-2 leading-relaxed">{a.cover_note}</p>}
              <div className="flex flex-wrap gap-1.5">
                <a href={a.cv_data_url} download={a.cv_filename}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20"
                  data-testid={`download-cv-${a.id}`}>
                  <FileText size={12} /> {a.cv_filename}
                </a>
                {STATUSES.filter((s) => s !== a.status).map((s) => (
                  <button key={s} onClick={() => updateStatus(a.id, s)}
                    className="px-2.5 py-1 rounded-full bg-gray-100 hover:bg-gray-200 text-xs font-semibold text-text-secondary capitalize"
                    data-testid={`set-status-${s}-${a.id}`}>
                    <Check size={11} className="inline mr-1" />{s}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default JobDetailPage;
