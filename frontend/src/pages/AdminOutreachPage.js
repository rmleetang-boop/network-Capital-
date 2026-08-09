// Iter 56d — Admin/Super-admin Non-User Outreach page.
// Send professional invitation emails to people not yet on Network Capital.
// Three template variants, sender-defined subject, single + bulk send, history.
// No tracking pixels (per user spec). 'Never contact me again' opt-out only.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Send, Mail, Upload, Users as UsersIcon, History as HistoryIcon, Eye, RotateCcw,
  Loader2, AlertCircle, Check, X, Plus, Search, ChevronRight, ShieldOff, Sparkles,
} from 'lucide-react';
import { axiosInstance } from '../App';
import { toast } from 'sonner';

const TABS = [
  { v: 'compose',      label: 'Compose',     Icon: Mail },
  { v: 'quick',        label: 'Quick send',  Icon: Send },
  { v: 'bulk',         label: 'Bulk send',   Icon: UsersIcon },
  { v: 'templates',    label: 'Templates',   Icon: Sparkles },
  { v: 'history',      label: 'History',     Icon: HistoryIcon },
  { v: 'suppressions', label: 'Opt-outs',    Icon: ShieldOff },
];

const EMPTY_COMPOSE = { recipients: '', subject: '', headline: '', body_html: '', cta_label: '', cta_url: '', template_id: '' };
const EMPTY_TPL = { name: '', subject: '', headline: '', body_html: '', cta_label: '', cta_url: '' };

const AdminOutreachPage = ({ user }) => {
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [tab, setTab] = useState('compose');
  const [templates, setTemplates] = useState([]);
  const [dbTemplates, setDbTemplates] = useState([]);
  const [compose, setCompose] = useState(EMPTY_COMPOSE);
  const [tplEdit, setTplEdit] = useState(null);   // null | {id?, ...EMPTY_TPL}
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState({ sent: 0, failed: 0, total: 0 });
  const [suppressions, setSuppressions] = useState([]);
  const [busy, setBusy] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const [form, setForm] = useState({ email: '', name: '', subject: '', template: 'future_through_network' });
  const [bulk, setBulk] = useState({ subject: '', template: 'future_through_network', recipients: [] });
  const [bulkText, setBulkText] = useState('');

  const isPriv = user && (user.role === 'super_admin' || user.role === 'admin');

  useEffect(() => {
    if (!isPriv) {
      toast.error('Admin access required');
      navigate('/');
      return;
    }
    loadTemplates();
    loadHistory();
    loadDbTemplates();
  }, []);

  const loadDbTemplates = async () => {
    try {
      const r = await axiosInstance.get('/admin/email-templates');
      setDbTemplates(r.data.templates || []);
    } catch { /* ignore */ }
  };

  const applyDbTemplate = (t) => {
    setCompose({
      ...compose,
      template_id: t.id,
      subject: t.subject || '',
      headline: t.headline || '',
      body_html: t.body_html || '',
      cta_label: t.cta_label || '',
      cta_url: t.cta_url || '',
    });
    toast.success(`Template "${t.name}" loaded — edit freely before sending`);
  };

  const composePreview = async () => {
    try {
      const r = await axiosInstance.post('/admin/email/preview', {
        recipients: compose.recipients || 'preview@example.com',
        subject: compose.subject, headline: compose.headline,
        body_html: compose.body_html, cta_label: compose.cta_label, cta_url: compose.cta_url,
      });
      setPreviewHtml(r.data.html);
      setShowPreview(true);
    } catch (e) { toast.error(e.response?.data?.detail || 'Could not render preview'); }
  };

  const composeSend = async () => {
    const emails = compose.recipients.split(/[,;\s\n]+/).filter((x) => x.includes('@'));
    if (!emails.length || !compose.subject || !compose.body_html) {
      toast.error('Recipients, subject and body are required');
      return;
    }
    if (!window.confirm(`Send this email to ${emails.length} recipient${emails.length > 1 ? 's' : ''}?`)) return;
    setBusy(true);
    try {
      const r = await axiosInstance.post('/admin/email/send', {
        recipients: compose.recipients,
        subject: compose.subject, headline: compose.headline,
        body_html: compose.body_html, cta_label: compose.cta_label, cta_url: compose.cta_url,
      });
      const s = r.data.summary || {};
      toast.success(`Sent ${s.sent}/${s.total}${s.failed ? ` — ${s.failed} failed` : ''}${s.suppressed ? ` — ${s.suppressed} opted out` : ''}`);
      setCompose({ ...EMPTY_COMPOSE });
      loadHistory();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Send failed');
    } finally { setBusy(false); }
  };

  const saveTemplate = async () => {
    if (!tplEdit) return;
    const { id, ...body } = tplEdit;
    if (!body.name || !body.subject || !body.headline || !body.body_html) {
      toast.error('Name, subject, headline and body are required');
      return;
    }
    setBusy(true);
    try {
      if (id) {
        await axiosInstance.put(`/admin/email-templates/${id}`, body);
        toast.success('Template updated');
      } else {
        await axiosInstance.post('/admin/email-templates', body);
        toast.success('Template created');
      }
      setTplEdit(null);
      loadDbTemplates();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not save template');
    } finally { setBusy(false); }
  };

  const deleteTemplate = async (id) => {
    if (!window.confirm('Delete this template? This cannot be undone.')) return;
    try {
      await axiosInstance.delete(`/admin/email-templates/${id}`);
      toast.success('Template deleted');
      loadDbTemplates();
    } catch (e) { toast.error(e.response?.data?.detail || 'Could not delete'); }
  };

  const loadTemplates = async () => {
    try {
      const r = await axiosInstance.get('/admin/outreach/templates');
      setTemplates(r.data.templates || []);
    } catch { toast.error('Could not load templates'); }
  };
  const loadHistory = async () => {
    try {
      const r = await axiosInstance.get('/admin/outreach/list?limit=100');
      setHistory(r.data.items || []);
      setStats(r.data.stats_30d || { sent: 0, failed: 0, total: 0 });
    } catch { /* ignore */ }
  };
  const loadSuppressions = async () => {
    try {
      const r = await axiosInstance.get('/admin/outreach/suppressions');
      setSuppressions(r.data.items || []);
    } catch { /* ignore */ }
  };

  const doPreview = async (name, template) => {
    try {
      const r = await axiosInstance.post('/admin/outreach/preview', { name, template });
      setPreviewHtml(r.data.html);
      setShowPreview(true);
    } catch { toast.error('Could not render preview'); }
  };

  const sendSingle = async () => {
    if (!form.email || !form.subject) {
      toast.error('Email + subject required');
      return;
    }
    setBusy(true);
    try {
      const r = await axiosInstance.post('/admin/outreach/send', form);
      if (r.data.ok) {
        toast.success(`Sent to ${form.email}`);
        setForm({ ...form, email: '', name: '' });
        loadHistory();
      } else {
        toast.error(`Could not send: ${r.data.status}`);
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Send failed');
    } finally { setBusy(false); }
  };

  const parseBulkText = () => {
    const lines = bulkText.split('\n').map((s) => s.trim()).filter(Boolean);
    const recipients = [];
    const seen = new Set();
    for (const ln of lines) {
      const parts = ln.split(/[,;\t]/).map((p) => p.trim().replace(/^"|"$/g, ''));
      const emailPart = parts.find((p) => p.includes('@'));
      const namePart = parts.find((p) => p && !p.includes('@'));
      if (!emailPart) continue;
      const em = emailPart.toLowerCase();
      if (seen.has(em)) continue;
      seen.add(em);
      recipients.push({ email: em, name: namePart || '' });
    }
    setBulk({ ...bulk, recipients });
    toast.success(`Parsed ${recipients.length} recipients`);
  };

  const uploadCSV = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      const r = await axiosInstance.post('/admin/outreach/upload-csv', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setBulk({ ...bulk, recipients: r.data.recipients || [] });
      toast.success(`Parsed ${r.data.count} recipients${r.data.truncated ? ' (truncated to 100)' : ''}`);
    } catch (err) {
      toast.error('Could not parse file');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const sendBulk = async () => {
    if (!bulk.recipients.length || !bulk.subject) {
      toast.error('Need recipients + subject');
      return;
    }
    if (!window.confirm(`Send to ${bulk.recipients.length} recipients?`)) return;
    setBusy(true);
    try {
      const r = await axiosInstance.post('/admin/outreach/bulk', bulk);
      const s = r.data.summary || {};
      toast.success(`Sent ${s.sent}/${s.total} — ${s.failed} failed, ${s.suppressed} suppressed`);
      setBulk({ ...bulk, recipients: [] });
      setBulkText('');
      loadHistory();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Bulk send failed');
    } finally { setBusy(false); }
  };

  const resend = async (id) => {
    if (!window.confirm('Resend this invitation?')) return;
    try {
      const r = await axiosInstance.post(`/admin/outreach/${id}/resend`);
      toast[r.data.ok ? 'success' : 'error'](r.data.ok ? 'Resent' : `Failed: ${r.data.status}`);
      loadHistory();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Resend failed');
    }
  };

  if (!isPriv) return null;

  return (
    <div className="min-h-screen bg-gray-50" data-testid="outreach-page">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary to-primary/85 text-white px-4 py-6">
        <div className="max-w-4xl mx-auto">
          <button onClick={() => navigate(-1)} className="text-[11px] text-white/70 hover:text-white mb-2">← Back</button>
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-white/15 flex items-center justify-center"><Mail size={20} /></div>
            <div>
              <p className="text-[10px] uppercase tracking-wider opacity-70">Admin · Outreach</p>
              <h1 className="font-heading font-bold text-xl sm:text-2xl">Invite people to Network Capital</h1>
              <p className="text-xs opacity-80 mt-0.5">Professional invitations · 3 templates · Brevo-powered · 500/day limit</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Stat label="Sent (30d)" value={stats.sent} />
            <Stat label="Failed" value={stats.failed} />
            <Stat label="Total" value={stats.total} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-4xl mx-auto px-4 py-3">
        <div className="flex items-center gap-1 overflow-x-auto -mx-4 px-4 scrollbar-hide" data-testid="outreach-tabs">
          {TABS.map((t) => (
            <button
              key={t.v}
              onClick={() => { setTab(t.v); if (t.v === 'history') loadHistory(); if (t.v === 'suppressions') loadSuppressions(); if (t.v === 'templates' || t.v === 'compose') loadDbTemplates(); }}
              className={`flex-shrink-0 px-3 py-2 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 ${tab === t.v ? 'bg-primary text-white' : 'bg-white border border-gray-200 text-text-secondary'}`}
              data-testid={`outreach-tab-${t.v}`}
            >
              <t.Icon size={12} /> {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 pb-12 space-y-4">
        {/* Compose — free email to ANY external address(es) */}
        {tab === 'compose' && (
          <div className="bg-white rounded-2xl p-4 border border-gray-100 space-y-3" data-testid="email-compose">
            <h2 className="font-heading font-bold text-base inline-flex items-center gap-1.5"><Mail size={14} /> Compose email</h2>
            <p className="text-[11px] text-text-muted">Send to any address — one or many (comma / newline separated). Not limited to platform users. Placeholders: {'{{name}}'} · {'{{email}}'}</p>
            {dbTemplates.length > 0 && (
              <Field label="Start from a template (optional)">
                <div className="flex flex-wrap gap-1.5">
                  {dbTemplates.map((t) => (
                    <button key={t.id} onClick={() => applyDbTemplate(t)}
                      className={`px-2.5 py-1.5 rounded-full text-[11px] font-bold border ${compose.template_id === t.id ? 'bg-primary text-white border-primary' : 'bg-white border-gray-200 text-text-secondary hover:border-primary/40'}`}
                      data-testid={`compose-template-${t.id}`}>
                      {t.name}
                    </button>
                  ))}
                </div>
              </Field>
            )}
            <Field label="Recipients (comma or newline separated)" required>
              <textarea rows={2} value={compose.recipients} onChange={(e) => setCompose({ ...compose, recipients: e.target.value })}
                placeholder="person@example.com, partner@company.com" className="w-full p-3 border border-gray-200 rounded-xl text-sm font-mono resize-none" data-testid="compose-recipients" />
            </Field>
            <Field label="Subject" required>
              <input value={compose.subject} onChange={(e) => setCompose({ ...compose, subject: e.target.value })}
                maxLength={180} placeholder="Subject line" className="w-full p-3 border border-gray-200 rounded-xl text-sm" data-testid="compose-subject" />
            </Field>
            <Field label="Headline (big title inside the email)">
              <input value={compose.headline} onChange={(e) => setCompose({ ...compose, headline: e.target.value })}
                maxLength={160} placeholder="A message from Network Capital" className="w-full p-3 border border-gray-200 rounded-xl text-sm" data-testid="compose-headline" />
            </Field>
            <Field label="Body (plain text or HTML)" required>
              <textarea rows={8} value={compose.body_html} onChange={(e) => setCompose({ ...compose, body_html: e.target.value })}
                placeholder={'Hi {{name}},\n\nWrite your message here…'} className="w-full p-3 border border-gray-200 rounded-xl text-sm resize-y" data-testid="compose-body" />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Button label (optional)">
                <input value={compose.cta_label} onChange={(e) => setCompose({ ...compose, cta_label: e.target.value })}
                  placeholder="Join Network Capital →" className="w-full p-3 border border-gray-200 rounded-xl text-sm" data-testid="compose-cta-label" />
              </Field>
              <Field label="Button link (optional)">
                <input value={compose.cta_url} onChange={(e) => setCompose({ ...compose, cta_url: e.target.value })}
                  placeholder="https://networkcapitalapp.co.za" className="w-full p-3 border border-gray-200 rounded-xl text-sm" data-testid="compose-cta-url" />
              </Field>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button onClick={composePreview} className="px-3 py-2.5 rounded-full bg-gray-100 text-text-secondary text-xs font-bold inline-flex items-center gap-1.5" data-testid="compose-preview-btn"><Eye size={12} /> Preview</button>
              <button onClick={composeSend} disabled={busy || !compose.recipients || !compose.subject || !compose.body_html}
                className="flex-1 px-4 py-3 rounded-full bg-primary text-white font-bold text-sm inline-flex items-center justify-center gap-1.5 disabled:opacity-50 shadow"
                data-testid="compose-send-btn">
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Send email
              </button>
            </div>
          </div>
        )}

        {/* Templates manager */}
        {tab === 'templates' && (
          <div className="space-y-3" data-testid="email-templates-tab">
            <div className="bg-white rounded-2xl p-4 border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-heading font-bold text-base inline-flex items-center gap-1.5"><Sparkles size={14} /> Email templates</h2>
                <button onClick={() => setTplEdit({ ...EMPTY_TPL })} className="px-3 py-1.5 rounded-full bg-primary text-white text-xs font-bold inline-flex items-center gap-1" data-testid="tpl-new-btn"><Plus size={12} /> New template</button>
              </div>
              <p className="text-[11px] text-text-muted mb-3">Fully editable — used by the Compose tab. Placeholders {'{{name}}'} and {'{{email}}'} are filled per recipient.</p>
              {dbTemplates.length === 0 ? (
                <p className="text-xs text-text-muted py-4 text-center">No templates yet — create one.</p>
              ) : (
                <div className="space-y-1.5">
                  {dbTemplates.map((t) => (
                    <div key={t.id} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-100 bg-gray-50/50" data-testid={`tpl-row-${t.id}`}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-text-primary truncate">{t.name}{t.is_seed ? <span className="ml-1.5 text-[9px] uppercase bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">starter</span> : null}</p>
                        <p className="text-[11px] text-text-muted truncate">{t.subject}</p>
                      </div>
                      <button onClick={() => setTplEdit({ id: t.id, name: t.name, subject: t.subject, headline: t.headline, body_html: t.body_html, cta_label: t.cta_label || '', cta_url: t.cta_url || '' })}
                        className="px-2.5 py-1.5 rounded-full bg-white border border-gray-200 text-[11px] font-bold" data-testid={`tpl-edit-${t.id}`}>Edit</button>
                      <button onClick={() => deleteTemplate(t.id)} className="p-2 rounded-full hover:bg-red-50 text-red-500" aria-label="Delete" data-testid={`tpl-delete-${t.id}`}><X size={14} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {tplEdit && (
              <div className="bg-white rounded-2xl p-4 border-2 border-primary/30 space-y-3" data-testid="tpl-editor">
                <h3 className="font-heading font-bold text-sm">{tplEdit.id ? 'Edit template' : 'New template'}</h3>
                <Field label="Template name" required>
                  <input value={tplEdit.name} onChange={(e) => setTplEdit({ ...tplEdit, name: e.target.value })} maxLength={80}
                    className="w-full p-3 border border-gray-200 rounded-xl text-sm" data-testid="tpl-name" />
                </Field>
                <Field label="Subject" required>
                  <input value={tplEdit.subject} onChange={(e) => setTplEdit({ ...tplEdit, subject: e.target.value })} maxLength={180}
                    className="w-full p-3 border border-gray-200 rounded-xl text-sm" data-testid="tpl-subject" />
                </Field>
                <Field label="Headline" required>
                  <input value={tplEdit.headline} onChange={(e) => setTplEdit({ ...tplEdit, headline: e.target.value })} maxLength={160}
                    className="w-full p-3 border border-gray-200 rounded-xl text-sm" data-testid="tpl-headline" />
                </Field>
                <Field label="Body (plain text or HTML)" required>
                  <textarea rows={8} value={tplEdit.body_html} onChange={(e) => setTplEdit({ ...tplEdit, body_html: e.target.value })}
                    className="w-full p-3 border border-gray-200 rounded-xl text-sm resize-y" data-testid="tpl-body" />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Button label">
                    <input value={tplEdit.cta_label} onChange={(e) => setTplEdit({ ...tplEdit, cta_label: e.target.value })}
                      className="w-full p-3 border border-gray-200 rounded-xl text-sm" data-testid="tpl-cta-label" />
                  </Field>
                  <Field label="Button link">
                    <input value={tplEdit.cta_url} onChange={(e) => setTplEdit({ ...tplEdit, cta_url: e.target.value })}
                      className="w-full p-3 border border-gray-200 rounded-xl text-sm" data-testid="tpl-cta-url" />
                  </Field>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button onClick={() => setTplEdit(null)} className="px-3 py-2.5 rounded-full bg-gray-100 text-text-secondary text-xs font-bold" data-testid="tpl-cancel">Cancel</button>
                  <button onClick={saveTemplate} disabled={busy}
                    className="flex-1 px-4 py-3 rounded-full bg-primary text-white font-bold text-sm inline-flex items-center justify-center gap-1.5 disabled:opacity-50" data-testid="tpl-save">
                    {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save template
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Template picker — shared */}
        {(tab === 'quick' || tab === 'bulk') && (
          <TemplatePicker
            templates={templates}
            value={tab === 'quick' ? form.template : bulk.template}
            onChange={(t) => tab === 'quick' ? setForm({ ...form, template: t }) : setBulk({ ...bulk, template: t })}
            onPreview={(t) => doPreview((tab === 'quick' ? form.name : 'Friend'), t)}
          />
        )}

        {/* Quick Send */}
        {tab === 'quick' && (
          <div className="bg-white rounded-2xl p-4 border border-gray-100 space-y-3" data-testid="outreach-quick">
            <h2 className="font-heading font-bold text-base inline-flex items-center gap-1.5"><Send size={14} /> Send one invitation</h2>
            <Field label="Recipient email" required>
              <input type="email" inputMode="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="them@example.com" className="w-full p-3 border border-gray-200 rounded-xl text-sm" data-testid="outreach-email" />
            </Field>
            <Field label="First name (personalises the greeting)">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Optional" className="w-full p-3 border border-gray-200 rounded-xl text-sm" data-testid="outreach-name" />
            </Field>
            <Field label="Subject line" required>
              <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder='e.g. "An invitation worth opening"' maxLength={180}
                className="w-full p-3 border border-gray-200 rounded-xl text-sm" data-testid="outreach-subject" />
            </Field>
            <div className="flex items-center gap-2 pt-2">
              <button onClick={() => doPreview(form.name, form.template)} className="px-3 py-2.5 rounded-full bg-gray-100 text-text-secondary text-xs font-bold inline-flex items-center gap-1.5" data-testid="outreach-preview-btn"><Eye size={12} /> Preview</button>
              <button onClick={sendSingle} disabled={busy || !form.email || !form.subject}
                className="flex-1 px-4 py-3 rounded-full bg-primary text-white font-bold text-sm inline-flex items-center justify-center gap-1.5 disabled:opacity-50 shadow"
                data-testid="outreach-send-single">
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Send invitation
              </button>
            </div>
          </div>
        )}

        {/* Bulk Send */}
        {tab === 'bulk' && (
          <div className="bg-white rounded-2xl p-4 border border-gray-100 space-y-3" data-testid="outreach-bulk">
            <h2 className="font-heading font-bold text-base inline-flex items-center gap-1.5"><UsersIcon size={14} /> Send bulk invitations</h2>
            <p className="text-[11px] text-text-muted">Max 100 per send. We skip already-registered users and opt-outs automatically.</p>
            <div className="flex flex-wrap items-center gap-2">
              <input ref={fileRef} type="file" accept=".csv,.txt,text/csv,text/plain" onChange={uploadCSV} className="hidden" data-testid="outreach-csv-input" />
              <button onClick={() => fileRef.current?.click()} className="px-3 py-2.5 rounded-full bg-white border border-gray-200 text-xs font-bold inline-flex items-center gap-1.5" data-testid="outreach-csv-upload"><Upload size={12} /> Upload CSV</button>
              <span className="text-[11px] text-text-muted">or paste below ↓</span>
            </div>
            <Field label="Paste recipients (one per line — email,name)">
              <textarea rows={5} value={bulkText} onChange={(e) => setBulkText(e.target.value)}
                placeholder="alice@example.com,Alice&#10;bob@example.com,Bob&#10;chen@example.com,Chen"
                className="w-full p-3 border border-gray-200 rounded-xl text-sm font-mono resize-none" data-testid="outreach-bulk-text" />
              <button onClick={parseBulkText} className="mt-2 text-xs text-primary font-bold">Parse list →</button>
            </Field>
            {bulk.recipients.length > 0 && (
              <div className="bg-gray-50 rounded-xl p-3 text-xs" data-testid="outreach-bulk-parsed">
                <p className="font-semibold mb-1">{bulk.recipients.length} recipients ready:</p>
                <div className="max-h-32 overflow-y-auto space-y-0.5">
                  {bulk.recipients.slice(0, 20).map((r, i) => (
                    <p key={i} className="text-text-muted">{r.email}{r.name ? ` — ${r.name}` : ''}</p>
                  ))}
                  {bulk.recipients.length > 20 && <p className="text-text-muted">+ {bulk.recipients.length - 20} more</p>}
                </div>
              </div>
            )}
            <Field label="Subject line" required>
              <input value={bulk.subject} onChange={(e) => setBulk({ ...bulk, subject: e.target.value })}
                placeholder='e.g. "Your network is your net worth"' maxLength={180}
                className="w-full p-3 border border-gray-200 rounded-xl text-sm" data-testid="outreach-bulk-subject" />
            </Field>
            <button onClick={sendBulk} disabled={busy || !bulk.recipients.length || !bulk.subject}
              className="w-full px-4 py-3 rounded-full bg-primary text-white font-bold text-sm inline-flex items-center justify-center gap-1.5 disabled:opacity-50 shadow"
              data-testid="outreach-send-bulk">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Send to {bulk.recipients.length} recipients
            </button>
          </div>
        )}

        {/* History */}
        {tab === 'history' && (
          <div className="bg-white rounded-2xl p-4 border border-gray-100" data-testid="outreach-history">
            <h2 className="font-heading font-bold text-base mb-2 inline-flex items-center gap-1.5"><HistoryIcon size={14} /> Recent invitations</h2>
            {history.length === 0 ? (
              <p className="text-xs text-text-muted py-4 text-center">No invitations sent yet.</p>
            ) : (
              <div className="space-y-1.5">
                {history.map((row) => (
                  <div key={row.id} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-100 bg-gray-50/50" data-testid={`outreach-row-${row.id}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-text-primary truncate">{row.email}{row.name ? ` · ${row.name}` : ''}</p>
                      <p className="text-[11px] text-text-muted truncate">{row.subject}</p>
                      <p className="text-[10px] text-text-muted">{(row.sent_at || '').slice(0, 16).replace('T', ' ')} · @{row.sender_username || 'admin'}</p>
                    </div>
                    <span className={`text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-full ${row.status === 'sent' ? 'bg-emerald-100 text-emerald-700' : row.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-gray-200 text-gray-700'}`}>
                      {row.never_contact ? 'opt-out' : row.status}
                    </span>
                    {!row.never_contact && (
                      <button onClick={() => resend(row.id)} className="p-2 rounded-full hover:bg-gray-100" aria-label="Resend" data-testid={`outreach-resend-${row.id}`}>
                        <RotateCcw size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Suppressions */}
        {tab === 'suppressions' && (
          <div className="bg-white rounded-2xl p-4 border border-gray-100" data-testid="outreach-suppressions">
            <h2 className="font-heading font-bold text-base mb-2 inline-flex items-center gap-1.5"><ShieldOff size={14} /> Opt-outs</h2>
            <p className="text-[11px] text-text-muted mb-3">People who chose "Never contact me again" via the email footer. We never re-send to these addresses.</p>
            {suppressions.length === 0 ? (
              <p className="text-xs text-text-muted py-4 text-center">No opt-outs yet.</p>
            ) : (
              <div className="space-y-1">
                {suppressions.map((s, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 rounded-xl bg-gray-50 text-xs">
                    <span className="font-mono">{s.email}</span>
                    <span className="text-text-muted">{(s.created_at || '').slice(0, 10)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Preview modal */}
      {showPreview && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setShowPreview(false)} data-testid="outreach-preview-modal">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[88vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h3 className="font-heading font-bold text-sm">Email preview</h3>
              <button onClick={() => setShowPreview(false)} className="p-1.5 rounded-full hover:bg-gray-100" data-testid="outreach-preview-close"><X size={16} /></button>
            </div>
            <iframe title="preview" srcDoc={previewHtml} className="flex-1 w-full border-0" />
          </div>
        </div>
      )}
    </div>
  );
};

const Stat = ({ label, value }) => (
  <div className="bg-white/10 backdrop-blur rounded-xl p-2.5">
    <p className="text-[10px] uppercase tracking-wider opacity-70">{label}</p>
    <p className="text-lg font-heading font-bold">{value}</p>
  </div>
);

const Field = ({ label, required, children }) => (
  <div>
    <label className="block text-[11px] font-semibold text-text-secondary mb-1">
      {label}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
    {children}
  </div>
);

const TemplatePicker = ({ templates, value, onChange, onPreview }) => (
  <div className="bg-white rounded-2xl p-4 border border-gray-100" data-testid="outreach-templates">
    <p className="text-xs font-semibold text-text-secondary mb-2 inline-flex items-center gap-1.5"><Sparkles size={12} /> Template</p>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
      {templates.map((t) => (
        <button
          key={t.id} onClick={() => onChange(t.id)}
          className={`text-left p-3 rounded-xl border-2 transition-all ${value === t.id ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-primary/30'}`}
          data-testid={`outreach-template-${t.id}`}
        >
          <p className="text-xs font-bold text-text-primary mb-0.5">{t.label}</p>
          <p className="text-[10px] text-text-muted line-clamp-2">{t.preview}</p>
          <button onClick={(e) => { e.stopPropagation(); onPreview(t.id); }} className="text-[10px] text-primary font-bold mt-1.5 inline-flex items-center gap-1" data-testid={`outreach-template-preview-${t.id}`}>
            <Eye size={10} /> Preview
          </button>
        </button>
      ))}
    </div>
  </div>
);

export default AdminOutreachPage;
