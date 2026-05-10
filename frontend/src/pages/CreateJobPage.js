import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Plus, X } from 'lucide-react';
import { axiosInstance } from '../App';
import { toast } from 'sonner';

const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Contract', 'Freelance', 'Internship', 'Performance & Growth Focused'];

const ChipsInput = ({ values, onChange, placeholder, testid }) => {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    onChange([...values, v]);
    setDraft('');
  };
  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {values.map((v, i) => (
          <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary text-xs font-semibold rounded-full">
            {v}
            <button onClick={() => onChange(values.filter((_, j) => j !== i))} className="hover:text-red-600">
              <X size={11} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={draft} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary"
          data-testid={testid}
        />
        <button type="button" onClick={add} className="px-3 py-2 bg-primary text-white rounded-xl text-sm font-semibold flex items-center gap-1">
          <Plus size={14} /> Add
        </button>
      </div>
    </div>
  );
};

const CreateJobPage = ({ user }) => {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState({
    title: '',
    company: user?.full_name || user?.username || '',
    location: 'Remote',
    employment_type: 'Full-time',
    salary: '',
    description: '',
    contact_email: user?.email || '',
    min_network_score: 0,
  });
  const [responsibilities, setResponsibilities] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [skills, setSkills] = useState([]);
  const [steps, setSteps] = useState([]);

  if (!user?.job_post_unlocked) {
    return (
      <div className="min-h-screen bg-background-DEFAULT flex items-center justify-center p-6 text-center">
        <div>
          <p className="text-text-secondary mb-3">You need to unlock job posting first ($50 once-off).</p>
          <button onClick={() => navigate('/jobs')} className="bg-primary text-white px-5 py-2.5 rounded-full font-semibold">
            Back to Jobs
          </button>
        </div>
      </div>
    );
  }

  const submit = async () => {
    if (!data.title.trim() || !data.description.trim()) {
      return toast.error('Title and description are required.');
    }
    setSubmitting(true);
    try {
      const payload = {
        ...data,
        min_network_score: Number(data.min_network_score) || 0,
        responsibilities, requirements, skills, application_steps: steps,
      };
      const r = await axiosInstance.post('/jobs', payload);
      toast.success('Job posted!');
      navigate(`/jobs/${r.data.id}`);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not post job');
    } finally {
      setSubmitting(false);
    }
  };

  const Field = ({ label, ...rest }) => (
    <div>
      <label className="block text-xs font-semibold text-text-secondary mb-1.5">{label}</label>
      <input {...rest} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary" />
    </div>
  );

  return (
    <div className="min-h-screen bg-background-DEFAULT pb-32" data-testid="create-job-page">
      <div className="sticky top-0 z-10 bg-white/85 backdrop-blur-lg border-b border-gray-200 px-4 py-3 flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-base font-heading font-bold text-primary flex-1">Post a job</h1>
        <button onClick={submit} disabled={submitting}
          className="bg-secondary text-primary font-bold px-4 py-1.5 rounded-full text-sm flex items-center gap-1.5 disabled:opacity-50"
          data-testid="publish-job-button">
          {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
          Publish
        </button>
      </div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="max-w-3xl mx-auto p-4 space-y-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
          <Field label="Job title *" data-testid="title-input"
            value={data.title} onChange={(e) => setData({ ...data, title: e.target.value })}
            placeholder="e.g., Business Developer Agent" />
          <Field label="Company / your brand"
            value={data.company} onChange={(e) => setData({ ...data, company: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Location"
              value={data.location} onChange={(e) => setData({ ...data, location: e.target.value })}
              placeholder="Remote / Cape Town / Hybrid" />
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">Employment type</label>
              <select value={data.employment_type}
                onChange={(e) => setData({ ...data, employment_type: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary">
                {EMPLOYMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <Field label="Salary / compensation"
            value={data.salary} onChange={(e) => setData({ ...data, salary: e.target.value })}
            placeholder="e.g., R8,500 CTC + Performance Commission" />
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <label className="block text-xs font-semibold text-text-secondary mb-1.5">About the role *</label>
          <textarea value={data.description} onChange={(e) => setData({ ...data, description: e.target.value })}
            rows={6} maxLength={6000}
            placeholder="Describe the role, the team, and what success looks like."
            className="w-full p-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary resize-none"
            data-testid="description-input" />
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <label className="block text-xs font-semibold text-text-secondary mb-1.5">Key responsibilities</label>
          <ChipsInput values={responsibilities} onChange={setResponsibilities} placeholder="Add a responsibility" testid="responsibilities-input" />
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <label className="block text-xs font-semibold text-text-secondary mb-1.5">Requirements</label>
          <ChipsInput values={requirements} onChange={setRequirements} placeholder="Add a requirement" testid="requirements-input" />
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <label className="block text-xs font-semibold text-text-secondary mb-1.5">Skills</label>
          <ChipsInput values={skills} onChange={setSkills} placeholder="e.g., Communication" testid="skills-input" />
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <label className="block text-xs font-semibold text-text-secondary mb-1.5">Application steps</label>
          <ChipsInput values={steps} onChange={setSteps} placeholder="e.g., Submit your CV (PDF or Word)" testid="steps-input" />
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
          <Field label="Recruitment contact email"
            value={data.contact_email} onChange={(e) => setData({ ...data, contact_email: e.target.value })}
            placeholder="recruitment@yourcompany.com" />
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Minimum Network Score (anti-spam)</label>
            <input type="number" min="0" max="10000"
              value={data.min_network_score}
              onChange={(e) => setData({ ...data, min_network_score: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary" />
            <p className="text-[11px] text-text-muted mt-1">Set 0 if anyone can apply.</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default CreateJobPage;
