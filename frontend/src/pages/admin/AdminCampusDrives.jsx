import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../../api/axios';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/authStore';
import { DriveSkillPicker } from '../../components/SkillPicker';

// ─── Status Badge ─────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const map = {
    DRAFT: ['grey','📝'], JD_SENT: ['blue','📨'], APPLICATIONS_OPEN: ['green','✅'],
    SHORTLISTING: ['orange','🔍'], SHORTLISTED: ['teal','🎯'], FURTHER_ROUNDS: ['purple','🔄'],
    COMPLETED: ['dark','🏁'], CANCELLED: ['red','❌'],
    APPLIED: ['grey','📄'], UNDER_REVIEW: ['orange','🔍'],
    AI_TEST_SENT: ['blue','🧠'], AI_TEST_PASSED: ['green','✅'], AI_TEST_FAILED: ['red','❌'],
    AI_TEST_COMPLETED: ['teal','✅'],
    INTERVIEW_SCHEDULED: ['purple','📅'], INTERVIEW_DONE: ['teal','🎤'],
    REJECTED: ['red','❌'], SELECTED: ['green','🏆'], OFFER_SENT: ['dark','📬'],
  };
  const [color, icon] = map[status] || ['grey','❓'];
  return (
    <span className={`admin-campus-status status-${color}`}>
      {icon} {status?.replace(/_/g, ' ')}
    </span>
  );
};

// ─── Empty JD template ───────────────────────────────────────────────────────
const emptyJD = () => ({
  role: '', skills: [], stipend: '', duration: '3 months',
  eligibility: '', minCGPA: 6.0, eligibleDisciplines: [], description: '',
});

// ─── Create Drive Modal ───────────────────────────────────────────────────────
function CreateDriveModal({ colleges, onClose, onCreated }) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    collegeId: '', cohort: '', title: '', description: '',
    driveDate: '', venue: '', mode: 'OFFLINE',
    jds: [emptyJD()],   // Always array of JDs
    shortlistingCriteria: { minATSScore: 60, minCGPA: 6.0, minClass10: 60, minClass12: 60, slots: 30 },
    enableInterviewRound: false,
    mcqConfig: { passingScore: 60, timeLimit: 20, questionCount: 10 },
  });

  const selectedCollege = colleges.find(c => c._id === form.collegeId);
  const set = (field, val) => setForm(f => ({ ...f, [field]: val }));
  const setCriteria = (field, val) => setForm(f => ({ ...f, shortlistingCriteria: { ...f.shortlistingCriteria, [field]: val } }));
  const setMcqConfig = (field, val) => setForm(f => ({ ...f, mcqConfig: { ...f.mcqConfig, [field]: val } }));

  const updateJD = (idx, field, val) => setForm(f => {
    const jds = [...f.jds];
    jds[idx] = { ...jds[idx], [field]: val };
    return { ...f, jds };
  });

  const addJD = () => setForm(f => ({ ...f, jds: [...f.jds, emptyJD()] }));
  const removeJD = (idx) => setForm(f => ({ ...f, jds: f.jds.filter((_, i) => i !== idx) }));

  const toggleDiscipline = (jdIdx, disc) => setForm(f => {
    const jds = [...f.jds];
    const cur = jds[jdIdx].eligibleDisciplines;
    jds[jdIdx] = { ...jds[jdIdx], eligibleDisciplines: cur.includes(disc) ? cur.filter(d => d !== disc) : [...cur, disc] };
    return { ...f, jds };
  });

  const handleCreate = async () => {
    if (!form.collegeId) return toast.error('Please select a college');
    if (!form.title) return toast.error('Drive title is required');
    for (let i = 0; i < form.jds.length; i++) {
      if (!form.jds[i].role) return toast.error(`Role is required for JD ${i + 1}`);
      if (form.jds[i].eligibleDisciplines.length === 0) return toast.error(`Select at least one discipline for JD ${i + 1}`);
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        jds: form.jds.map(j => ({ ...j, stipend: Number(j.stipend), minCGPA: Number(j.minCGPA) })),
      };
      const { data } = await axios.post(`/college/admin/drives`, payload);
      toast.success('Drive created & JD sent to college!');
      onCreated(data.drive);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create drive');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box modal-lg">
        <div className="modal-header">
          <h2>🏫 Create Campus Drive</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-steps">
          {['Drive Info', 'Job Descriptions', 'Pipeline & Criteria'].map((s, i) => (
            <div key={s} className={`modal-step ${step === i + 1 ? 'active' : step > i + 1 ? 'done' : ''}`}>
              <div className="modal-step-num">{step > i + 1 ? '✓' : i + 1}</div>
              <span>{s}</span>
            </div>
          ))}
        </div>

        <div className="modal-body">
          {/* ── Step 1: Drive Info ─────────────────────────────────────── */}
          {step === 1 && (
            <div className="modal-step-content">
              <div className="form-row">
                <div className="form-field">
                  <label>College *</label>
                  <select value={form.collegeId} onChange={e => { set('collegeId', e.target.value); }} required>
                    <option value="">Select College</option>
                    {colleges.map(c => <option key={c._id} value={c._id}>{c.name} ({c.code}) — {c.city}</option>)}
                  </select>
                </div>
                <div className="form-field">
                  <label>Drive Mode</label>
                  <select value={form.mode} onChange={e => set('mode', e.target.value)}>
                    <option value="OFFLINE">Offline (On-Campus)</option>
                    <option value="ONLINE">Online</option>
                    <option value="HYBRID">Hybrid</option>
                  </select>
                </div>
              </div>
              <div className="form-field">
                <label>Cohort (optional)</label>
                <input type="text" value={form.cohort} onChange={e => set('cohort', e.target.value)} placeholder="e.g. 2026 Graduating Batch" />
              </div>
              <div className="form-field">
                <label>Drive Title *</label>
                <input type="text" value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Summer Internship Drive 2025 – PICT" />
              </div>
              <div className="form-field">
                <label>Description</label>
                <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3} placeholder="Brief about the drive..." />
              </div>
              <div className="form-row">
                <div className="form-field">
                  <label>Drive Date</label>
                  <input type="date" value={form.driveDate} onChange={e => set('driveDate', e.target.value)} />
                </div>
                <div className="form-field">
                  <label>Venue</label>
                  <input type="text" value={form.venue} onChange={e => set('venue', e.target.value)} placeholder="Main Auditorium, PICT" />
                </div>
              </div>
            </div>
          )}

          {/* ── Step 2: Multiple JDs ───────────────────────────────────── */}
          {step === 2 && (
            <div className="modal-step-content">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <p className="modal-hint" style={{ margin: 0 }}>
                  Add one or more job roles for this drive. Each JD will have its own application link.
                </p>
                <button type="button" className="btn btn-ghost" onClick={addJD} style={{ whiteSpace: 'nowrap' }}>
                  + Add JD
                </button>
              </div>

              {form.jds.map((jd, idx) => (
                <div key={idx} className="jd-card">
                  <div className="jd-card-header">
                    <span className="jd-card-label">📋 JD #{idx + 1}</span>
                    {form.jds.length > 1 && (
                      <button type="button" className="btn-remove-jd" onClick={() => removeJD(idx)} title="Remove this JD">×</button>
                    )}
                  </div>
                  <div className="jd-card-body">
                    <div className="form-row">
                      <div className="form-field">
                        <label>Role / Position *</label>
                        <input
                          type="text"
                          value={jd.role}
                          onChange={e => updateJD(idx, 'role', e.target.value)}
                          placeholder="Software Developer Intern"
                        />
                      </div>
                      <div className="form-field">
                        <label>Stipend (₹/month)</label>
                        <input type="number" value={jd.stipend} onChange={e => updateJD(idx, 'stipend', e.target.value)} placeholder="10000" />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-field">
                        <label>Duration</label>
                        <select value={jd.duration} onChange={e => updateJD(idx, 'duration', e.target.value)}>
                          <option value="1 month">1 Month</option>
                          <option value="2 months">2 Months</option>
                          <option value="3 months">3 Months</option>
                          <option value="6 months">6 Months</option>
                        </select>
                      </div>
                      <div className="form-field">
                        <label>Min CGPA</label>
                        <input type="number" step="0.1" min="0" max="10" value={jd.minCGPA} onChange={e => updateJD(idx, 'minCGPA', e.target.value)} />
                      </div>
                    </div>
                    <div className="form-field">
                      <label>Required Skills</label>
                      <DriveSkillPicker
                        role={jd.role}
                        selected={jd.skills}
                        onChange={skills => updateJD(idx, 'skills', skills)}
                      />
                    </div>
                    <div className="form-field">
                      <label>
                        Eligible Disciplines *&nbsp;
                        <span style={{ fontWeight: 400, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          — {jd.eligibleDisciplines.length} of {selectedCollege?.disciplines?.length ?? 0} selected
                        </span>
                      </label>
                      {!selectedCollege ? (
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>← Go back and select a college first</p>
                      ) : (selectedCollege.disciplines?.length > 0) ? (
                        <div className="discipline-picker">
                          <button type="button" className="btn btn-ghost discipline-select-all" onClick={() =>
                            updateJD(idx, 'eligibleDisciplines',
                              jd.eligibleDisciplines.length === selectedCollege.disciplines.length
                                ? [] : [...selectedCollege.disciplines])}>
                            {jd.eligibleDisciplines.length === selectedCollege.disciplines.length ? '☑ Deselect All' : '☐ Select All'}
                          </button>
                          <div className="discipline-grid">
                            {selectedCollege.disciplines.map(disc => (
                              <label key={disc} className={`discipline-chip ${jd.eligibleDisciplines.includes(disc) ? 'selected' : ''}`}>
                                <input type="checkbox" checked={jd.eligibleDisciplines.includes(disc)} onChange={() => toggleDiscipline(idx, disc)} style={{ display: 'none' }} />
                                {disc}
                              </label>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No disciplines listed for this college</p>
                      )}
                    </div>
                    <div className="form-field">
                      <label>Eligibility Criteria (text summary)</label>
                      <input type="text" value={jd.eligibility} onChange={e => updateJD(idx, 'eligibility', e.target.value)} placeholder="Open to CSE / IT final year students with CGPA ≥ 7.0" />
                    </div>
                    <div className="form-field">
                      <label>Detailed Job Description</label>
                      <textarea value={jd.description} onChange={e => updateJD(idx, 'description', e.target.value)} rows={3} placeholder="Detailed role responsibilities..." />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Step 3: Pipeline & Shortlisting Criteria ───────────────── */}
          {step === 3 && (
            <div className="modal-step-content">
              {/* Interview Round Toggle */}
              <div className="pipeline-config-box">
                <h3 style={{ margin: '0 0 12px', fontSize: '1rem', color: 'var(--clr-text)' }}>
                  🔄 Selection Pipeline
                </h3>
                <label className="pipeline-toggle-row">
                  <input
                    type="checkbox"
                    checked={form.enableInterviewRound}
                    onChange={e => set('enableInterviewRound', e.target.checked)}
                  />
                  <span>Enable Interview Round (Round 2)</span>
                </label>
                <div className="pipeline-flow">
                  <span className="pipeline-step active">Shortlisted</span>
                  <span className="pipeline-arrow">→</span>
                  <span className="pipeline-step active">AI Test</span>
                  <span className="pipeline-arrow">→</span>
                  {form.enableInterviewRound && (
                    <>
                      <span className="pipeline-step active">Interview</span>
                      <span className="pipeline-arrow">→</span>
                    </>
                  )}
                  <span className="pipeline-step active">Internship Offer</span>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--clr-text-2)', marginTop: 8 }}>
                  {form.enableInterviewRound
                    ? '✅ Students will go through: AI Test → Interview → Offer'
                    : '⚡ Students will go through: AI Test → Direct Offer (no interview)'}
                </p>
              </div>

              {/* MCQ Config */}
              <div className="pipeline-config-box" style={{ marginTop: 16 }}>
                <h3 style={{ margin: '0 0 12px', fontSize: '1rem', color: 'var(--clr-text)' }}>
                  🧠 AI MCQ Test Settings
                </h3>
                <div className="form-row">
                  <div className="form-field">
                    <label>Number of Questions</label>
                    <input type="number" min="5" max="30" value={form.mcqConfig.questionCount} onChange={e => setMcqConfig('questionCount', Number(e.target.value))} />
                  </div>
                  <div className="form-field">
                    <label>Passing Score (%)</label>
                    <input type="number" min="1" max="100" value={form.mcqConfig.passingScore} onChange={e => setMcqConfig('passingScore', Number(e.target.value))} />
                  </div>
                  <div className="form-field">
                    <label>Time Limit (minutes)</label>
                    <input type="number" min="5" max="120" value={form.mcqConfig.timeLimit} onChange={e => setMcqConfig('timeLimit', Number(e.target.value))} />
                  </div>
                </div>
              </div>

              {/* Shortlisting Criteria */}
              <div className="pipeline-config-box" style={{ marginTop: 16 }}>
                <h3 style={{ margin: '0 0 12px', fontSize: '1rem', color: 'var(--clr-text)' }}>
                  ⚡ Auto-Shortlisting Criteria
                </h3>
                <p className="modal-hint">Set minimum thresholds for automatic shortlisting.</p>
                <div className="form-row">
                  <div className="form-field">
                    <label>Min ATS Score (0–100)</label>
                    <input type="number" min="0" max="100" value={form.shortlistingCriteria.minATSScore} onChange={e => setCriteria('minATSScore', Number(e.target.value))} />
                  </div>
                  <div className="form-field">
                    <label>Min CGPA</label>
                    <input type="number" step="0.1" min="0" max="10" value={form.shortlistingCriteria.minCGPA} onChange={e => setCriteria('minCGPA', Number(e.target.value))} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-field">
                    <label>Min 10th %</label>
                    <input type="number" min="0" max="100" value={form.shortlistingCriteria.minClass10} onChange={e => setCriteria('minClass10', Number(e.target.value))} />
                  </div>
                  <div className="form-field">
                    <label>Min 12th %</label>
                    <input type="number" min="0" max="100" value={form.shortlistingCriteria.minClass12} onChange={e => setCriteria('minClass12', Number(e.target.value))} />
                  </div>
                </div>
                <div className="form-field">
                  <label>Max Slots</label>
                  <input type="number" min="1" value={form.shortlistingCriteria.slots} onChange={e => setCriteria('slots', Number(e.target.value))} />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          {step > 1 && <button className="btn btn-ghost" onClick={() => setStep(s => s - 1)}>← Back</button>}
          {step < 3 ? (
            <button className="btn btn-primary" onClick={() => setStep(s => s + 1)} disabled={!form.collegeId && step === 1}>Next →</button>
          ) : (
            <button className="btn btn-primary" onClick={handleCreate} disabled={saving}>
              {saving ? 'Creating...' : '🚀 Create Drive & Send JD'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── MCQ Editor Modal ─────────────────────────────────────────────────────────
function MCQEditorModal({ appId, drive, onClose, onSent }) {
  const [questions, setQuestions] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [generated, setGenerated] = useState(false);

  const generateQuestions = async () => {
    setGenerating(true);
    try {
      const { data } = await axios.post(`/college/admin/applications/${appId}/generate-test`);
      setQuestions(data.questions || []);
      setGenerated(true);
      toast.success(`${data.questions.length} questions generated! Review and edit below.`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate questions');
    } finally {
      setGenerating(false);
    }
  };

  const updateQuestion = (idx, field, val) => {
    setQuestions(qs => {
      const updated = [...qs];
      updated[idx] = { ...updated[idx], [field]: val };
      return updated;
    });
  };

  const updateOption = (qIdx, optIdx, val) => {
    setQuestions(qs => {
      const updated = [...qs];
      const opts = [...updated[qIdx].options];
      opts[optIdx] = val;
      updated[qIdx] = { ...updated[qIdx], options: opts };
      return updated;
    });
  };

  const addQuestion = () => {
    setQuestions(qs => [...qs, {
      q: '', options: ['A. ', 'B. ', 'C. ', 'D. '], correct: 'A'
    }]);
  };

  const removeQuestion = (idx) => {
    setQuestions(qs => qs.filter((_, i) => i !== idx));
  };

  const saveQuestions = async () => {
    if (questions.length === 0) return toast.error('Add at least one question');
    setSaving(true);
    try {
      await axios.put(`/college/admin/applications/${appId}/update-test-questions`, { questions });
      toast.success('Questions saved!');
    } catch (err) {
      toast.error('Failed to save questions');
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    if (questions.length === 0) return toast.error('Generate questions first');
    setSending(true);
    try {
      // Save first, then send
      await axios.put(`/college/admin/applications/${appId}/update-test-questions`, { questions });
      const { data } = await axios.post(`/college/admin/applications/${appId}/send-ai-test`);
      toast.success(`Test sent! ${data.message}`);
      onSent();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send test');
    } finally {
      setSending(false);
    }
  };

  const correctOptions = ['A', 'B', 'C', 'D'];

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box modal-xl">
        <div className="modal-header">
          <div>
            <h2>🧠 AI MCQ Test Editor</h2>
            <div className="modal-sub">
              {drive?.mcqConfig?.questionCount || 10} questions •&nbsp;
              {drive?.mcqConfig?.passingScore || 60}% passing score •&nbsp;
              {drive?.mcqConfig?.timeLimit || 20} min
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {!generated && questions.length === 0 ? (
            <div className="mcq-generate-prompt">
              <div style={{ fontSize: '3rem', marginBottom: 16 }}>🤖</div>
              <h3>Generate AI Questions</h3>
              <p>Click below to generate role-specific MCQ questions based on the job description and required skills. You can review, edit, add or remove questions before sending.</p>
              <button className="btn btn-primary" onClick={generateQuestions} disabled={generating} style={{ marginTop: 16 }}>
                {generating ? '⏳ Generating...' : '✨ Generate Questions with AI'}
              </button>
            </div>
          ) : (
            <>
              <div className="mcq-toolbar">
                <span className="mcq-count">{questions.length} questions</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-ghost btn-sm" onClick={generateQuestions} disabled={generating}>
                    {generating ? '⏳ Regenerating...' : '🔄 Regenerate All'}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={addQuestion}>
                    + Add Question
                  </button>
                </div>
              </div>

              <div className="mcq-questions-list">
                {questions.map((q, qi) => (
                  <div key={qi} className="mcq-question-card">
                    <div className="mcq-q-header">
                      <span className="mcq-q-num">Q{qi + 1}</span>
                      <button className="mcq-q-delete" onClick={() => removeQuestion(qi)} title="Remove question">🗑</button>
                    </div>
                    <div className="form-field" style={{ marginBottom: 12 }}>
                      <label style={{ fontSize: '0.8rem' }}>Question</label>
                      <textarea
                        value={q.q}
                        onChange={e => updateQuestion(qi, 'q', e.target.value)}
                        rows={2}
                        placeholder="Enter question text..."
                        className="mcq-q-text"
                      />
                    </div>
                    <div className="mcq-options-grid">
                      {(q.options || ['A. ', 'B. ', 'C. ', 'D. ']).map((opt, oi) => (
                        <div key={oi} className={`mcq-option ${q.correct === correctOptions[oi] ? 'correct' : ''}`}>
                          <label className="mcq-option-radio" title="Mark as correct answer">
                            <input
                              type="radio"
                              name={`correct-${qi}`}
                              checked={q.correct === correctOptions[oi]}
                              onChange={() => updateQuestion(qi, 'correct', correctOptions[oi])}
                            />
                            <span className="mcq-option-letter">{correctOptions[oi]}</span>
                          </label>
                          <input
                            type="text"
                            value={opt}
                            onChange={e => updateOption(qi, oi, e.target.value)}
                            placeholder={`${correctOptions[oi]}. Option ${oi + 1}`}
                            className="mcq-option-input"
                          />
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--clr-text-2)', marginTop: 6 }}>
                      ✅ Correct: <strong>{q.correct}</strong> — click radio button to change
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {(generated || questions.length > 0) && (
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={saveQuestions} disabled={saving}>
              {saving ? 'Saving...' : '💾 Save Draft'}
            </button>
            <button className="btn btn-primary" onClick={sendTest} disabled={sending || questions.length === 0}>
              {sending ? 'Sending...' : `🚀 Send Test to Student (${questions.length} Qs)`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Offer Letter Template Modal ──────────────────────────────────────────────
function OfferLetterTemplateModal({ drive, onClose, onSaved }) {
  const [form, setForm] = useState({
    companyName: drive.offerLetterTemplate?.companyName || 'HireStorm / Innobytes',
    signatoryName: drive.offerLetterTemplate?.signatoryName || 'HR Team',
    signatoryTitle: drive.offerLetterTemplate?.signatoryTitle || 'Campus Placement Division, HireStorm',
    footerText: drive.offerLetterTemplate?.footerText || 'HireStorm — Connecting Campuses with Opportunity  |  hirestorm.innobytes.io',
    logoUrl: drive.offerLetterTemplate?.logoUrl || '',
    customTerms: drive.offerLetterTemplate?.customTerms || [],
  });
  const [saving, setSaving] = useState(false);
  const [newTerm, setNewTerm] = useState('');

  const set = (field, val) => setForm(f => ({ ...f, [field]: val }));

  const addTerm = () => {
    if (!newTerm.trim()) return;
    setForm(f => ({ ...f, customTerms: [...f.customTerms, newTerm.trim()] }));
    setNewTerm('');
  };

  const removeTerm = (idx) => setForm(f => ({ ...f, customTerms: f.customTerms.filter((_, i) => i !== idx) }));

  const updateTerm = (idx, val) => setForm(f => {
    const terms = [...f.customTerms];
    terms[idx] = val;
    return { ...f, customTerms: terms };
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.put(`/college/admin/drives/${drive._id}/offer-template`, form);
      toast.success('Offer letter template saved!');
      onSaved();
      onClose();
    } catch (err) {
      toast.error('Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const defaultTerms = [
    'This internship offer is subject to successful completion of background verification.',
    'The intern is expected to report punctually and maintain professional conduct throughout the duration.',
    'All work produced during the internship remains the intellectual property of the organization.',
    'The stipend will be disbursed monthly after the submission of the daily progress log.',
    'Either party may terminate this internship with a 7-day written notice.',
  ];

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box modal-lg">
        <div className="modal-header">
          <div>
            <h2>📄 Offer Letter Template</h2>
            <div className="modal-sub">Customize the offer letter PDF that students receive</div>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="offer-template-grid">
            <div className="offer-template-form">
              <div className="form-field">
                <label>Company / Organization Name</label>
                <input type="text" value={form.companyName} onChange={e => set('companyName', e.target.value)} placeholder="HireStorm / Innobytes" />
              </div>
              <div className="form-row">
                <div className="form-field">
                  <label>Signatory Name</label>
                  <input type="text" value={form.signatoryName} onChange={e => set('signatoryName', e.target.value)} placeholder="HR Team" />
                </div>
                <div className="form-field">
                  <label>Signatory Title</label>
                  <input type="text" value={form.signatoryTitle} onChange={e => set('signatoryTitle', e.target.value)} placeholder="Campus Placement Division" />
                </div>
              </div>
              <div className="form-field">
                <label>Footer Text</label>
                <input type="text" value={form.footerText} onChange={e => set('footerText', e.target.value)} placeholder="Footer text for the PDF" />
              </div>
              <div className="form-field">
                <label>Logo URL (optional)</label>
                <input type="url" value={form.logoUrl} onChange={e => set('logoUrl', e.target.value)} placeholder="https://..." />
              </div>

              <div className="form-field">
                <label>Custom Terms & Conditions</label>
                <p style={{ fontSize: '0.8rem', color: 'var(--clr-text-2)', marginBottom: 8 }}>
                  {form.customTerms.length === 0
                    ? 'Using default terms (shown below). Add custom terms to override them.'
                    : `${form.customTerms.length} custom terms added. These will replace the defaults.`}
                </p>
                <div className="custom-terms-list">
                  {form.customTerms.map((term, i) => (
                    <div key={i} className="custom-term-row">
                      <span className="custom-term-num">{i + 1}.</span>
                      <input type="text" value={term} onChange={e => updateTerm(i, e.target.value)} className="custom-term-input" />
                      <button className="custom-term-del" onClick={() => removeTerm(i)}>×</button>
                    </div>
                  ))}
                </div>
                <div className="add-term-row">
                  <input
                    type="text"
                    value={newTerm}
                    onChange={e => setNewTerm(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addTerm()}
                    placeholder="Type a custom term and press Enter or click +"
                    className="add-term-input"
                  />
                  <button className="btn btn-ghost btn-sm" onClick={addTerm}>+ Add</button>
                </div>
              </div>

              {form.customTerms.length === 0 && (
                <div className="default-terms-preview">
                  <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--clr-text-2)', marginBottom: 8 }}>Default Terms (will be used if no custom terms):</p>
                  <ol style={{ fontSize: '0.8rem', color: 'var(--clr-text-2)', paddingLeft: 20, lineHeight: 1.8 }}>
                    {defaultTerms.map((t, i) => <li key={i}>{t}</li>)}
                  </ol>
                </div>
              )}
            </div>

            {/* Live Preview */}
            <div className="offer-letter-preview">
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--clr-text-2)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                PDF Preview
              </div>
              <div className="offer-preview-card">
                <div className="offer-preview-header">
                  <div className="offer-preview-logo">⚡ HireStorm</div>
                  <div className="offer-preview-sub">Campus Placement Division</div>
                </div>
                <div className="offer-preview-title">INTERNSHIP OFFER LETTER</div>
                <div className="offer-preview-body">
                  <p><strong>Dear [Student Name],</strong></p>
                  <p>We are pleased to extend this formal offer of internship to you from <strong>{form.companyName}</strong>...</p>
                  <div className="offer-preview-table">
                    {[['Role', '[Job Role]'], ['Start Date', '[Date]'], ['Stipend', '[Amount]']].map(([k, v]) => (
                      <div key={k} className="offer-preview-row"><span>{k}</span><span>{v}</span></div>
                    ))}
                  </div>
                  <div className="offer-preview-footer-sig">
                    <strong>For {form.companyName}</strong><br />
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{form.signatoryName}</span><br />
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{form.signatoryTitle}</span>
                  </div>
                </div>
                <div className="offer-preview-footer">{form.footerText}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : '💾 Save Template'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Send Offer Modal ─────────────────────────────────────────────────────────
function SendOfferModal({ app, drive, onClose, onSent }) {
  const effectiveJD = (drive?.jds && drive.jds.length > 0)
    ? (drive.jds[app.jdIndex ?? 0] || drive.jds[0])
    : (drive?.jd || {});

  const [form, setForm] = useState({
    startDate: '',
    endDate: '',
    stipend: effectiveJD.stipend || 10000,
  });
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!form.startDate || !form.endDate) return toast.error('Please enter start and end dates');
    setSending(true);
    try {
      const { data } = await axios.post(`/college/admin/applications/${app._id}/send-offer`, {
        startDate: form.startDate,
        endDate: form.endDate,
        stipend: { amount: Number(form.stipend), currency: 'INR' },
      });
      toast.success(data.message);
      onSent();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send offer');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box modal-sm">
        <div className="modal-header">
          <h2>📬 Send Internship Offer</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="offer-student-info">
            <span>👤 {app.student.name}</span>
            <span>📧 {app.student.email}</span>
            <span>💼 {effectiveJD.role || 'Intern'}</span>
          </div>
          <div style={{ background: 'var(--clr-surface-2)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '0.8rem', color: 'var(--clr-text-2)' }}>
            📎 A PDF offer letter will be <strong>attached to the email</strong> automatically.
          </div>
          <div className="form-field">
            <label>Internship Start Date *</label>
            <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
          </div>
          <div className="form-field">
            <label>Internship End Date *</label>
            <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
          </div>
          <div className="form-field">
            <label>Stipend (₹/month)</label>
            <input type="number" value={form.stipend} onChange={e => setForm(f => ({ ...f, stipend: e.target.value }))} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSend} disabled={sending}>
            {sending ? 'Sending...' : '📬 Send Offer with PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Drive Detail Modal ───────────────────────────────────────────────────────
function DriveDetailModal({ drive: initialDrive, onClose, onRefresh }) {
  const [drive, setDrive] = useState(initialDrive);
  const [apps, setApps] = useState([]);
  const [tab, setTab] = useState('info');
  const [shortlisting, setShortlisting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mcqTarget, setMcqTarget] = useState(null);   // { appId, app }
  const [offerTarget, setOfferTarget] = useState(null); // app
  const [showOfferTemplate, setShowOfferTemplate] = useState(false);

  useEffect(() => {
    if (tab === 'applications') fetchApps();
  }, [tab]);

  const fetchApps = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`/college/admin/drives/${drive._id}/applications`);
      setApps(data.applications || []);
    } catch { toast.error('Failed to load applications'); }
    finally { setLoading(false); }
  };

  const handleShortlist = async () => {
    setShortlisting(true);
    try {
      const { data } = await axios.post(`/college/admin/drives/${drive._id}/shortlist`, {});
      toast.success(data.message);
      onRefresh();
      fetchApps();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Shortlisting failed');
    } finally {
      setShortlisting(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    try {
      await axios.put(`/college/admin/drives/${drive._id}`, { status: newStatus });
      toast.success('Status updated');
      onRefresh();
    } catch { toast.error('Failed to update status'); }
  };

  const handleInterviewDone = async (appId) => {
    try {
      await axios.patch(`/college/admin/applications/${appId}`, {
        status: 'INTERVIEW_DONE',
        'interview.outcome': 'PASSED',
      });
      toast.success('Interview marked as done');
      fetchApps();
    } catch (err) {
      toast.error('Failed to update interview status');
    }
  };

  // Get effective JD for a given application
  const getJDForApp = (app) => {
    if (drive.jds && drive.jds.length > 0) {
      return drive.jds[app.jdIndex ?? 0] || drive.jds[0];
    }
    return drive.jd || {};
  };

  // Determine action buttons for each application
  const renderActions = (app) => {
    const { status } = app;
    const hasInterview = drive.enableInterviewRound;

    if (status === 'SHORTLISTED') {
      return (
        <button className="btn-action btn-mcq" onClick={() => setMcqTarget(app)} id={`btn-gen-test-${app._id}`}>
          🧠 Review & Send Test
        </button>
      );
    }
    if (status === 'AI_TEST_SENT') {
      return <span style={{ fontSize: '0.75rem', color: 'var(--clr-text-2)' }}>⏳ Test sent</span>;
    }
    if (status === 'AI_TEST_PASSED') {
      if (hasInterview) {
        return (
          <button className="btn-action btn-interview" onClick={() => scheduleInterview(app)} id={`btn-interview-${app._id}`}>
            📅 Schedule Interview
          </button>
        );
      } else {
        return (
          <button className="btn-action btn-offer" onClick={() => setOfferTarget(app)} id={`btn-offer-${app._id}`}>
            📬 Send Offer
          </button>
        );
      }
    }
    if (status === 'INTERVIEW_SCHEDULED') {
      return (
        <button className="btn-action btn-ghost-sm" onClick={() => handleInterviewDone(app._id)}>
          ✅ Mark Done
        </button>
      );
    }
    if (status === 'INTERVIEW_DONE') {
      return (
        <button className="btn-action btn-offer" onClick={() => setOfferTarget(app)} id={`btn-offer-${app._id}`}>
          📬 Send Offer
        </button>
      );
    }
    return null;
  };

  const scheduleInterview = async (app) => {
    const meetLink = prompt('Google Meet link:');
    if (!meetLink) return;
    const scheduledAt = prompt('Interview date/time (YYYY-MM-DDTHH:MM):');
    try {
      await axios.post(`/college/admin/applications/${app._id}/schedule-interview`, { meetLink, scheduledAt });
      toast.success('Interview scheduled and email sent!');
      fetchApps();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to schedule interview');
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box modal-xl">
        <div className="modal-header">
          <div>
            <h2>{drive.title}</h2>
            <div className="modal-sub">{drive.college?.name} • {drive.college?.city}</div>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-tabs">
          {[
            { key: 'info', label: '📋 Drive Info' },
            { key: 'applications', label: '👥 Applications' },
            { key: 'offer-template', label: '📄 Offer Letter' },
          ].map(t => (
            <button key={t.key} className={`modal-tab-btn ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="modal-body">
          {/* ── Info Tab ──────────────────────────────────────────────── */}
          {tab === 'info' && (
            <div className="drive-detail-info">
              <div className="drive-info-row">
                <div className="drive-info-label">Status</div>
                <div className="drive-info-val">
                  <StatusBadge status={drive.status} />
                  <select
                    className="status-change-select"
                    defaultValue={drive.status}
                    onChange={e => handleStatusChange(e.target.value)}
                  >
                    {['DRAFT','JD_SENT','APPLICATIONS_OPEN','SHORTLISTING','SHORTLISTED','FURTHER_ROUNDS','COMPLETED','CANCELLED'].map(s => (
                      <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="drive-info-row">
                <div className="drive-info-label">Pipeline</div>
                <div className="drive-info-val">
                  <div className="pipeline-flow" style={{ fontSize: '0.8rem' }}>
                    <span className="pipeline-step active">Shortlisted</span>
                    <span className="pipeline-arrow">→</span>
                    <span className="pipeline-step active">AI Test</span>
                    <span className="pipeline-arrow">→</span>
                    {drive.enableInterviewRound && (
                      <>
                        <span className="pipeline-step active">Interview</span>
                        <span className="pipeline-arrow">→</span>
                      </>
                    )}
                    <span className="pipeline-step active">Offer (PDF via Email)</span>
                  </div>
                </div>
              </div>
              <div className="drive-info-row">
                <div className="drive-info-label">Drive Date</div>
                <div className="drive-info-val">{drive.driveDate ? new Date(drive.driveDate).toLocaleDateString('en-IN') : 'TBD'}</div>
              </div>
              <div className="drive-info-row">
                <div className="drive-info-label">Applicants / Shortlisted / Selected</div>
                <div className="drive-info-val">
                  <strong>{drive.totalApplicants || 0}</strong> / <strong>{drive.totalShortlisted || 0}</strong> / <strong>{drive.totalSelected || 0}</strong>
                </div>
              </div>
              {drive.applicationFormUrl && (
                <div className="drive-info-row">
                  <div className="drive-info-label">Form URL</div>
                  <div className="drive-info-val form-url-row">
                    <code>{drive.applicationFormUrl}</code>
                    <button onClick={() => { navigator.clipboard.writeText(drive.applicationFormUrl); toast.success('Copied!'); }}>📋</button>
                  </div>
                </div>
              )}

              {/* JDs Display */}
              {(drive.jds?.length > 0 ? drive.jds : drive.jd ? [drive.jd] : []).map((jd, idx) => (
                <div key={idx} className="drive-jd-box">
                  <h3>📄 Job Description {drive.jds?.length > 1 ? `#${idx + 1}` : ''}</h3>
                  <div className="jd-tags">
                    <span>💼 {jd.role}</span>
                    <span>💰 ₹{jd.stipend?.toLocaleString()}/mo</span>
                    <span>⏱️ {jd.duration}</span>
                    <span>📊 Min CGPA: {jd.minCGPA}</span>
                  </div>
                  {jd.skills?.length > 0 && (
                    <div className="jd-skills">
                      {jd.skills.map(s => <span key={s} className="skill-chip">{s}</span>)}
                    </div>
                  )}
                  {jd.description && <p style={{ fontSize: '0.85rem', color: 'var(--clr-text-2)', marginTop: 8 }}>{jd.description}</p>}
                </div>
              ))}

              <div className="drive-actions">
                <button className="btn btn-warning" onClick={handleShortlist} disabled={shortlisting}>
                  {shortlisting ? 'Running...' : '⚡ Run Auto-Shortlisting'}
                </button>
                <button className="btn btn-ghost" onClick={() => setShowOfferTemplate(true)}>
                  ✏️ Edit Offer Letter Template
                </button>
              </div>
            </div>
          )}

          {/* ── Applications Tab ──────────────────────────────────────── */}
          {tab === 'applications' && (
            <div className="drive-apps-panel">
              {loading ? <div className="college-loading">Loading...</div> : (
                apps.length === 0 ? (
                  <div className="college-empty-state"><span>📭</span><p>No applications yet.</p></div>
                ) : (
                  <div className="college-table-wrap">
                    <table className="college-table">
                      <thead>
                        <tr>
                          <th>#</th><th>Name</th><th>Email</th><th>Branch</th>
                          <th>CGPA</th><th>ATS</th><th>Overall</th>
                          <th>Role</th><th>Status</th><th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {apps.map((app, i) => {
                          const jd = getJDForApp(app);
                          return (
                            <tr key={app._id}>
                              <td>{i + 1}</td>
                              <td>{app.student.name}</td>
                              <td style={{ fontSize: '0.8rem' }}>{app.student.email}</td>
                              <td>{app.student.branch}</td>
                              <td>{app.student.cgpa?.toFixed(2)}</td>
                              <td>
                                <span className={`score-pill ${app.atsScore >= 70 ? 'high' : app.atsScore >= 50 ? 'mid' : 'low'}`}>
                                  {app.atsScore ?? '—'}
                                </span>
                              </td>
                              <td><strong>{app.overallScore ?? '—'}</strong></td>
                              <td>
                                <span style={{ fontSize: '0.78rem', background: 'var(--clr-primary-light)', color: 'var(--clr-primary)', padding: '2px 8px', borderRadius: 12 }}>
                                  {jd.role || '—'}
                                </span>
                              </td>
                              <td><StatusBadge status={app.status} /></td>
                              <td>{renderActions(app)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              )}
            </div>
          )}

          {/* ── Offer Letter Template Tab ──────────────────────────────── */}
          {tab === 'offer-template' && (
            <div style={{ padding: '8px 0' }}>
              <div style={{ background: 'var(--clr-surface-2)', borderRadius: 10, padding: 20, marginBottom: 16 }}>
                <h3 style={{ margin: '0 0 8px', fontSize: '1rem' }}>📄 Current Offer Letter Settings</h3>
                <div className="offer-template-summary">
                  <div><strong>Company Name:</strong> {drive.offerLetterTemplate?.companyName || 'HireStorm / Innobytes (default)'}</div>
                  <div><strong>Signatory:</strong> {drive.offerLetterTemplate?.signatoryName || 'HR Team (default)'}</div>
                  <div><strong>Custom Terms:</strong> {drive.offerLetterTemplate?.customTerms?.length > 0 ? `${drive.offerLetterTemplate.customTerms.length} custom terms` : 'Using defaults'}</div>
                </div>
              </div>
              <button className="btn btn-primary" onClick={() => setShowOfferTemplate(true)}>
                ✏️ Edit Offer Letter Template
              </button>
              <div style={{ marginTop: 20, padding: 16, background: 'var(--clr-surface-2)', borderRadius: 8, fontSize: '0.85rem' }}>
                <p style={{ margin: '0 0 8px', fontWeight: 600 }}>📎 How PDF delivery works:</p>
                <p style={{ margin: '0', color: 'var(--clr-text-2)', lineHeight: 1.7 }}>
                  When you send an internship offer, the system automatically generates a PDF offer letter using the template above and attaches it directly to the email. The student receives the PDF as an email attachment — no Cloudinary link, no download page needed.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MCQ Editor Modal */}
      {mcqTarget && (
        <MCQEditorModal
          appId={mcqTarget._id}
          drive={drive}
          onClose={() => setMcqTarget(null)}
          onSent={() => { fetchApps(); onRefresh(); }}
        />
      )}

      {/* Send Offer Modal */}
      {offerTarget && (
        <SendOfferModal
          app={offerTarget}
          drive={drive}
          onClose={() => setOfferTarget(null)}
          onSent={() => { fetchApps(); onRefresh(); }}
        />
      )}

      {/* Offer Letter Template Modal */}
      {showOfferTemplate && (
        <OfferLetterTemplateModal
          drive={drive}
          onClose={() => setShowOfferTemplate(false)}
          onSaved={() => {
            onRefresh();
            // Refresh drive data
            axios.get(`/college/admin/drives`).catch(() => {});
          }}
        />
      )}
    </div>
  );
}

// ─── Main Admin Campus Page ───────────────────────────────────────────────────
export default function AdminCampusDrives() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [colleges, setColleges] = useState([]);
  const [drives, setDrives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDrive, setShowCreateDrive] = useState(false);
  const [selectedDrive, setSelectedDrive] = useState(null);
  const [filterCollege, setFilterCollege] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [colRes, driveRes] = await Promise.all([
        axios.get(`/college/admin/list`),
        axios.get(`/college/admin/drives`),
      ]);
      setColleges(colRes.data.colleges || []);
      setDrives(driveRes.data.drives || []);
    } catch (err) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filteredDrives = drives.filter(d => {
    if (filterCollege && d.college?._id !== filterCollege) return false;
    if (filterStatus && d.status !== filterStatus) return false;
    return true;
  });

  const totalApplicants = drives.reduce((s, d) => s + (d.totalApplicants || 0), 0);
  const totalShortlisted = drives.reduce((s, d) => s + (d.totalShortlisted || 0), 0);
  const totalSelected = drives.reduce((s, d) => s + (d.totalSelected || 0), 0);

  return (
    <div className="admin-campus-page">
      <div className="admin-campus-header">
        <div>
          <h1>🏫 Campus Hiring Drives</h1>
          <p>Manage college drives, JDs, applications, AI tests, and internship offers</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreateDrive(true)}>
          + New Drive
        </button>
      </div>

      {/* Stats */}
      <div className="admin-campus-stats">
        {[
          { label: 'Colleges', value: colleges.length, icon: '🏫', color: 'blue' },
          { label: 'Total Drives', value: drives.length, icon: '📋', color: 'purple' },
          { label: 'Applicants', value: totalApplicants, icon: '📄', color: 'orange' },
          { label: 'Shortlisted', value: totalShortlisted, icon: '✅', color: 'teal' },
          { label: 'Selected', value: totalSelected, icon: '🏆', color: 'green' },
        ].map(s => (
          <div key={s.label} className={`admin-campus-stat stat-${s.color}`}>
            <span className="admin-campus-stat-icon">{s.icon}</span>
            <strong>{s.value}</strong>
            <span>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Colleges overview */}
      <div className="admin-campus-section">
        <h2>Registered Colleges</h2>
        <div className="admin-colleges-grid">
          {colleges.map(col => (
            <div key={col._id} className="admin-college-chip">
              <div className="admin-college-chip-code">{col.code}</div>
              <div className="admin-college-chip-name">{col.name}</div>
              <div className={`admin-college-chip-uni uni-${col.university?.toLowerCase()}`}>{col.university}</div>
              <div className="admin-college-chip-stats">
                {col.totalDrives} drives • {col.totalSelected} selected
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Drives table */}
      <div className="admin-campus-section">
        <div className="admin-campus-drives-header">
          <h2>All Drives</h2>
          <div className="admin-campus-filters">
            <select value={filterCollege} onChange={e => setFilterCollege(e.target.value)}>
              <option value="">All Colleges</option>
              {colleges.map(c => <option key={c._id} value={c._id}>{c.code}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">All Status</option>
              {['DRAFT','JD_SENT','APPLICATIONS_OPEN','SHORTLISTING','SHORTLISTED','FURTHER_ROUNDS','COMPLETED','CANCELLED'].map(s => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="college-loading">Loading drives...</div>
        ) : filteredDrives.length === 0 ? (
          <div className="college-empty-state">
            <span>📭</span><p>No drives found. Create one above!</p>
          </div>
        ) : (
          <div className="admin-drives-table-wrap">
            <table className="college-table">
              <thead>
                <tr>
                  <th>College</th><th>Drive</th><th>JDs</th><th>Date</th><th>Status</th>
                  <th>Applied</th><th>Shortlisted</th><th>Selected</th><th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredDrives.map(drive => (
                  <tr key={drive._id} className="college-table-row">
                    <td>
                      <div className="drive-college-cell">
                        <span className="drive-college-code">{drive.college?.code}</span>
                        <span className="drive-college-city">{drive.college?.city}</span>
                      </div>
                    </td>
                    <td className="drive-title-cell">{drive.title}</td>
                    <td>
                      <span style={{ fontSize: '0.8rem', background: 'var(--clr-primary-light)', color: 'var(--clr-primary)', padding: '2px 8px', borderRadius: 12 }}>
                        {(drive.jds?.length || 0) > 0 ? `${drive.jds.length} role${drive.jds.length > 1 ? 's' : ''}` : drive.jd?.role ? '1 role' : '—'}
                      </span>
                    </td>
                    <td>{drive.driveDate ? new Date(drive.driveDate).toLocaleDateString('en-IN') : '—'}</td>
                    <td><StatusBadge status={drive.status} /></td>
                    <td>{drive.totalApplicants || 0}</td>
                    <td>{drive.totalShortlisted || 0}</td>
                    <td>{drive.totalSelected || 0}</td>
                    <td>
                      <button className="btn-view" onClick={() => setSelectedDrive(drive)}>View →</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreateDrive && (
        <CreateDriveModal
          colleges={colleges}
          onClose={() => setShowCreateDrive(false)}
          onCreated={() => fetchAll()}
        />
      )}
      {selectedDrive && (
        <DriveDetailModal
          drive={selectedDrive}
          onClose={() => setSelectedDrive(null)}
          onRefresh={fetchAll}
        />
      )}
    </div>
  );
}
