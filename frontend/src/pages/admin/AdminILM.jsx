import React, { useEffect, useState } from 'react';
import AdminLayout from '../../layouts/AdminLayout';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import {
  User, Clock, CheckCircle2, ChevronDown, ChevronUp, Check, X,
  Plus, UserCheck, Send, Award, BookOpen, AlertCircle, ListChecks,
  TrendingUp, XCircle,
} from 'lucide-react';
import { DOMAINS } from '../../utils/constants';

const TABS = ['All Interns', 'Send Offer', 'Assign Mentor', 'Offer Transactions'];

const STATUS_COLORS = {
  OFFER_SENT:         'badge-yellow',
  ACCEPTED:           'badge-blue',
  REJECTED:           'badge-red',
  ACTIVE:             'badge-green',
  COMPLETED:          'badge-blue',
  TERMINATED:         'badge-red',
  FAILED_ASSESSMENT:  'badge-red',
};

export default function AdminILM() {
  const [activeTab, setActiveTab] = useState('All Interns');
  const [internships, setInternships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [expandedIlm, setExpandedIlm] = useState(null);

  // Score daily log
  const [scoringLog, setScoringLog] = useState(null);
  const [scoreValue, setScoreValue] = useState('');
  const [logFeedback, setLogFeedback] = useState('');
  const [commentValue, setCommentValue] = useState('');

  // Monthly review form
  const [reviewingIlm, setReviewingIlm] = useState(null);
  const [reviewForm, setReviewForm] = useState({
    month: 1, taskCompletion: 0, codeQuality: 0, communication: 0, initiative: 0, feedback: '',
  });

  // Send offer form — mentorId defaults to first admin after users load
  const [offerForm, setOfferForm] = useState({
    userId: '', mentorId: '', startDate: '', stipendAmount: 10000, domain: 'Full Stack Development', durationDays: 90,
  });
  const [sendingOffer, setSendingOffer] = useState(false);

  // Assign mentor form
  const [assignForm, setAssignForm] = useState({ internshipId: '', mentorId: '' });
  const [assigning, setAssigning] = useState(false);

  const fetchInternships = () => {
    setLoading(true);
    api.get('/ilm/all')
      .then(r => { setInternships(r.data.data || []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  const fetchUsers = () => {
    api.get('/admin/users').then(r => {
      const allUsers = r.data.data || [];
      setUsers(allUsers);
      // Default mentor = SUPER_ADMIN (Sachin Deshpande)
      const superAdmin = allUsers.find(u => u.role === 'MENTOR')
        || allUsers.find(u => u.role === 'SUPER_ADMIN')
        || allUsers.find(u => u.role === 'PLATFORM_ADMIN');
      if (superAdmin) {
        setOfferForm(p => ({ ...p, mentorId: superAdmin._id }));
      }
    }).catch(() => {});
  };

  useEffect(() => { fetchInternships(); fetchUsers(); }, []);

  // ── Send Offer ─────────────────────────────────────────────────────────────
  const handleSendOffer = async (e) => {
    e.preventDefault();
    if (!offerForm.userId) return toast.error('Please select a student');
    setSendingOffer(true);
    try {
      await api.post(`/ilm/offer/${offerForm.userId}`, {
        mentorId:      offerForm.mentorId || null,
        startDate:     offerForm.startDate || new Date().toISOString(),
        stipendAmount: Number(offerForm.stipendAmount),
        domain:        offerForm.domain,
        durationDays:  Number(offerForm.durationDays),
      });
      toast.success('✅ Offer sent! Student will see it on their dashboard.');
      // Reset form but keep mentor defaulted to SUPER_ADMIN
      const superAdmin = users.find(u => u.role === 'MENTOR') || users.find(u => u.role === 'SUPER_ADMIN') || users.find(u => u.role === 'PLATFORM_ADMIN');
      setOfferForm({ userId: '', mentorId: superAdmin?._id || '', startDate: '', stipendAmount: 10000, domain: 'Full Stack Development', durationDays: 90 });
      fetchInternships();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send offer');
    } finally { setSendingOffer(false); }
  };

  // ── Assign Mentor ──────────────────────────────────────────────────────────
  const handleAssignMentor = async (e) => {
    e.preventDefault();
    if (!assignForm.internshipId || !assignForm.mentorId) return toast.error('Select internship and mentor');
    setAssigning(true);
    try {
      await api.patch(`/ilm/${assignForm.internshipId}/assign-mentor`, { mentorId: assignForm.mentorId });
      toast.success('✅ Mentor assigned!');
      setAssignForm({ internshipId: '', mentorId: '' });
      fetchInternships();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to assign mentor');
    } finally { setAssigning(false); }
  };

  // ── Score & Comment Daily Log ──────────────────────────────────────────────
  const handleScoreLog = async (ilmId, logId) => {
    if (scoreValue === '' || scoreValue < 0 || scoreValue > 10) return toast.error('Score must be 0-10');
    try {
      await api.put(`/ilm/${ilmId}/logs/${logId}/score`, { score: Number(scoreValue), feedback: logFeedback });
      toast.success('Log reviewed successfully!');
      setScoringLog(null);
      setScoreValue('');
      setLogFeedback('');
      fetchInternships();
    } catch (err) { toast.error('Failed to submit review'); }
  };

  const handleAddComment = async (ilmId, logId) => {
    if (!commentValue.trim()) return;
    try {
      await api.post(`/ilm/${ilmId}/logs/${logId}/comment`, { message: commentValue });
      toast.success('Comment added');
      setCommentValue('');
      fetchInternships();
    } catch (err) { toast.error('Failed to add comment'); }
  };

  // ── Monthly Review ─────────────────────────────────────────────────────────
  const handleMonthlyReview = async (e) => {
    e.preventDefault();
    const total = reviewForm.taskCompletion + reviewForm.codeQuality + reviewForm.communication + reviewForm.initiative;
    if (total > 100) return toast.error('Total score cannot exceed 100');
    try {
      await api.put(`/ilm/mentoring/${reviewingIlm}/monthly-review`, reviewForm);
      toast.success('Monthly review submitted!');
      setReviewingIlm(null);
      setReviewForm({ month: 1, taskCompletion: 0, codeQuality: 0, communication: 0, initiative: 0, feedback: '' });
      fetchInternships();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to submit review'); }
  };

  const students = users.filter(u => ['STUDENT', 'PRO_STUDENT', 'INTERN'].includes(u.role));
  const admins   = users.filter(u => ['MENTOR', 'PLATFORM_ADMIN', 'SUPER_ADMIN'].includes(u.role));

  // ── Offer Transactions stats ──────────────────────────────────────────────
  const txStats = {
    total:    internships.length,
    sent:     internships.filter(i => i.status === 'OFFER_SENT').length,
    accepted: internships.filter(i => ['ACCEPTED', 'ACTIVE', 'COMPLETED'].includes(i.status)).length,
    active:   internships.filter(i => i.status === 'ACTIVE').length,
    rejected: internships.filter(i => i.status === 'REJECTED' || i.offerStatus === 'REJECTED').length,
    completed:internships.filter(i => i.status === 'COMPLETED').length,
  };

  return (
    <AdminLayout>
      <div className="page">
        <div className="page-header">
          <h1>Internship Lifecycle Management (ILM)</h1>
          <p className="text-muted">Manage 90-day internship offers, mentor allocation, and reviews.</p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 28, borderBottom: '1px solid var(--clr-border)', paddingBottom: 0 }}>
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '10px 20px', fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer',
                border: 'none', background: 'none', color: activeTab === tab ? 'var(--clr-primary)' : 'var(--clr-text-2)',
                borderBottom: activeTab === tab ? '2px solid var(--clr-primary)' : '2px solid transparent',
                marginBottom: -1, transition: 'all 0.15s',
              }}
            >{tab}</button>
          ))}
        </div>

        {/* ── Tab: All Interns ────────────────────────────────────────────── */}
        {activeTab === 'All Interns' && (
          loading ? (
            <div className="skeleton" style={{ height: 300, borderRadius: 'var(--r-sm)' }} />
          ) : internships.length === 0 ? (
            <div className="empty-state">
              <User size={48} style={{ color: 'var(--clr-text-3)', marginBottom: 16 }} />
              <h3>No Active Internships</h3>
              <p>Go to "Send Offer" tab to send your first internship offer.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {internships.map(ilm => (
                <div key={ilm._id} className="card" style={{ padding: 20, border: '1px solid var(--clr-border)' }}>
                  {/* Header Row */}
                  <div
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                    onClick={() => setExpandedIlm(expandedIlm === ilm._id ? null : ilm._id)}
                  >
                    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                      <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--clr-primary-dim)', color: 'var(--clr-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18 }}>
                        {ilm.intern?.profile?.firstName?.[0]}{ilm.intern?.profile?.lastName?.[0]}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{ilm.intern?.profile?.firstName} {ilm.intern?.profile?.lastName}</div>
                        <div className="text-sm text-muted">
                          College: {ilm.college?.code || ilm.college?.name || 'Unassigned'}{ilm.cohort ? ` · ${ilm.cohort}` : ''} · Mentor: {ilm.mentor ? (`${ilm.mentor?.profile?.firstName || ''} ${ilm.mentor?.profile?.lastName || ''}`.trim() || 'Unassigned') : 'Unassigned'}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {/* No Mentor badge removed because we default to Sachin Deshpande */}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span className={`badge ${ilm.status === 'ACTIVE' ? 'badge-green' : ilm.status === 'COMPLETED' ? 'badge-blue' : 'badge-yellow'}`}>{ilm.status}</span>
                        <div className="text-xs text-muted" style={{ marginTop: 4 }}>
                          CA: {Math.round(ilm.continuousAssessmentScore || 0)}/100 • Logs: {ilm.dailyLogs?.length || 0}
                        </div>
                      </div>
                      {expandedIlm === ilm._id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                  </div>

                  {/* Expanded Panel */}
                  {expandedIlm === ilm._id && (
                    <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid var(--clr-border)', display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
                      {/* Daily Logs */}
                      <div>
                        <h3 style={{ fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Clock size={15} /> Daily Logs ({ilm.dailyLogs?.length || 0})
                        </h3>
                        {!ilm.dailyLogs?.length ? (
                          <p className="text-sm text-muted">No logs submitted yet.</p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 400, overflowY: 'auto' }}>
                            {[...ilm.dailyLogs].reverse().map(log => (
                              <div key={log._id} style={{ padding: 12, background: 'var(--clr-surface-2)', borderRadius: 'var(--r-sm)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                  <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{new Date(log.date).toDateString()}</span>
                                  {log.status === 'REVIEWED' && log.mentorScore !== undefined ? (
                                    <span className="badge badge-green">Score: {log.mentorScore}/10</span>
                                  ) : (
                                    <button className="btn btn-outline btn-sm" onClick={() => setScoringLog(scoringLog === log._id ? null : log._id)}>
                                      Review
                                    </button>
                                  )}
                                </div>
                                <p className="text-sm text-muted" style={{ marginBottom: 6 }}>{log.workDone || log.task}</p>
                                {log.blockers && <p className="text-xs" style={{ color: 'var(--clr-warning)' }}>⚠ {log.blockers}</p>}
                                {log.hoursWorked && (
                                  <p className="text-xs text-muted" style={{ marginTop: 4 }}>⏱ {log.hoursWorked} hours worked</p>
                                )}

                                {scoringLog === log._id && log.status !== 'REVIEWED' && (
                                  <div style={{ marginTop: 12, padding: 12, background: 'rgba(0,0,0,0.1)', borderRadius: 'var(--r-sm)' }}>
                                    <input type="number" min="0" max="10" placeholder="Score (0-10)" value={scoreValue} onChange={e => setScoreValue(e.target.value)} className="w-full mb-2" />
                                    <textarea rows={2} placeholder="Feedback comment (optional)..." value={logFeedback} onChange={e => setLogFeedback(e.target.value)} className="w-full mb-2" />
                                    <button className="btn btn-primary btn-sm w-full" onClick={() => handleScoreLog(ilm._id, log._id)}>Submit Review</button>
                                  </div>
                                )}

                                {log.comments && log.comments.length > 0 && (
                                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--clr-border)' }}>
                                    <p style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 8 }}>Discussion Thread:</p>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                      {log.comments.map(c => (
                                        <div key={c._id} style={{ padding: 8, background: c.role === 'MENTOR' ? 'rgba(79, 126, 248, 0.1)' : 'rgba(255,255,255,0.05)', borderRadius: 6 }}>
                                          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: c.role === 'MENTOR' ? 'var(--clr-primary)' : 'var(--clr-text-2)', marginBottom: 2 }}>
                                            {c.role === 'MENTOR' ? 'Mentor' : 'Intern'}
                                          </div>
                                          <div style={{ fontSize: '0.85rem' }}>{c.message}</div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                
                                {log.status === 'REVIEWED' && (
                                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                                    <input type="text" placeholder="Reply..." value={scoringLog === log._id ? commentValue : ''} onChange={e => setCommentValue(e.target.value)} onFocus={() => setScoringLog(log._id)} className="w-full" style={{ padding: '6px 10px', fontSize: '0.85rem' }} />
                                    <button className="btn btn-primary btn-sm" onClick={() => handleAddComment(ilm._id, log._id)}><Send size={14}/></button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Monthly Reviews */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                          <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}><CheckCircle2 size={15} /> Reviews</h3>
                          <button className="btn btn-primary btn-sm" onClick={() => { setReviewingIlm(ilm._id); setReviewForm({ month: 1, taskCompletion: 0, codeQuality: 0, communication: 0, initiative: 0, feedback: '' }); }}>
                            <Plus size={14} /> Add
                          </button>
                        </div>

                        {reviewingIlm === ilm._id && (
                          <div style={{ padding: 14, background: 'var(--clr-surface-2)', borderRadius: 'var(--r-sm)', marginBottom: 14 }}>
                            <form onSubmit={handleMonthlyReview} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                              <div className="form-group">
                                <label>Month (1–3)</label>
                                <select value={reviewForm.month} onChange={e => setReviewForm(p => ({ ...p, month: Number(e.target.value) }))}>
                                  <option value={1}>Month 1</option>
                                  <option value={2}>Month 2</option>
                                  <option value={3}>Month 3</option>
                                </select>
                              </div>
                              {[
                                { key: 'taskCompletion', label: 'Task Completion (0–25)' },
                                { key: 'codeQuality',    label: 'Code Quality (0–25)' },
                                { key: 'communication',  label: 'Communication (0–25)' },
                                { key: 'initiative',     label: 'Initiative (0–25)' },
                              ].map(({ key, label }) => (
                                <div className="form-group" key={key}>
                                  <label>{label}</label>
                                  <input type="number" min="0" max="25" value={reviewForm[key]}
                                    onChange={e => setReviewForm(p => ({ ...p, [key]: Number(e.target.value) }))} />
                                </div>
                              ))}
                              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--clr-primary)' }}>
                                Total: {reviewForm.taskCompletion + reviewForm.codeQuality + reviewForm.communication + reviewForm.initiative}/100
                              </div>
                              <div className="form-group">
                                <label>Feedback</label>
                                <textarea rows={2} value={reviewForm.feedback} onChange={e => setReviewForm(p => ({ ...p, feedback: e.target.value }))} />
                              </div>
                              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setReviewingIlm(null)}>Cancel</button>
                                <button type="submit" className="btn btn-primary btn-sm">Submit</button>
                              </div>
                            </form>
                          </div>
                        )}

                        {[1, 2, 3].map(month => {
                          const rev = ilm.monthlyReviews?.find(r => r.month === month);
                          return (
                            <div key={month} style={{ padding: '10px 12px', border: '1px solid var(--clr-border)', borderRadius: 'var(--r-sm)', marginBottom: 8 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Month {month}</span>
                                {rev?.status === 'COMPLETED'
                                  ? <span className="badge badge-green">{rev.totalScore}/100</span>
                                  : <span className="badge badge-gray">Pending</span>}
                              </div>
                              {rev?.feedback && <p className="text-xs text-muted" style={{ marginTop: 4 }}>{rev.feedback}</p>}
                            </div>
                          );
                        })}

                        {/* WBS Progress */}
                        {ilm.wbs?.length > 0 && (
                          <div style={{ marginTop: 16 }}>
                            <div className="text-sm" style={{ fontWeight: 700, marginBottom: 8 }}>WBS Progress</div>
                            {ilm.wbs.slice(0, 4).map(w => {
                              const done = w.tasks?.filter(t => t.status === 'DONE').length || 0;
                              const total = w.tasks?.length || 1;
                              return (
                                <div key={w.week} style={{ marginBottom: 6 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                                    <span>Week {w.week}: {w.topic}</span>
                                    <span>{done}/{total}</span>
                                  </div>
                                  <div style={{ height: 4, background: 'var(--clr-surface-2)', borderRadius: 4, marginTop: 2 }}>
                                    <div style={{ height: '100%', width: `${(done / total) * 100}%`, background: 'var(--clr-success)', borderRadius: 4 }} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )}

        {/* ── Tab: Send Offer ─────────────────────────────────────────────── */}
        {activeTab === 'Send Offer' && (
          <div style={{ maxWidth: 600, margin: '0 auto' }}>
            <div className="card" style={{ padding: 32 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--clr-primary-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Send size={20} style={{ color: 'var(--clr-primary)' }} />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Send Internship Offer</h2>
                  <p className="text-sm text-muted">Generate and send an offer letter to a shortlisted student.</p>
                </div>
              </div>

              <div style={{ padding: '14px 16px', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 'var(--r-sm)', marginBottom: 24, display: 'flex', gap: 10 }}>
                <AlertCircle size={16} style={{ color: 'var(--clr-primary)', flexShrink: 0, marginTop: 2 }} />
                <p className="text-sm" style={{ color: 'var(--clr-text-2)' }}>
                  When you send an offer, the student sees a banner on their dashboard to Accept or Decline. Mentor defaults to the System Admin.
                </p>
              </div>

              <form onSubmit={handleSendOffer} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="form-group">
                  <label>Select Student *</label>
                  <select value={offerForm.userId} onChange={e => setOfferForm(p => ({ ...p, userId: e.target.value }))} required>
                    <option value="">— Choose a student —</option>
                    {students.map(u => (
                      <option key={u._id} value={u._id}>
                        {u.profile?.firstName} {u.profile?.lastName} ({u.email}) — {u.role}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="form-group">
                    <label>Duration (Days)</label>
                    <select value={offerForm.durationDays} onChange={e => setOfferForm(p => ({ ...p, durationDays: e.target.value }))}>
                      <option value="90">90 Days</option>
                      <option value="180">180 Days</option>
                      <option value="360">360 Days</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Assign Mentor (defaults to Super Admin)</label>
                    <select value={offerForm.mentorId} onChange={e => setOfferForm(p => ({ ...p, mentorId: e.target.value }))}>
                      <option value="">— No mentor —</option>
                      {admins.map(u => (
                        <option key={u._id} value={u._id}>
                          {u.profile?.firstName} {u.profile?.lastName} ({u.role})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="form-group">
                    <label>Start Date</label>
                    <input type="date" value={offerForm.startDate}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={e => setOfferForm(p => ({ ...p, startDate: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Monthly Stipend (₹)</label>
                    <input type="number" min="0" step="500" value={offerForm.stipendAmount}
                      onChange={e => setOfferForm(p => ({ ...p, stipendAmount: e.target.value }))} />
                  </div>
                </div>

                <div className="form-group">
                  <label>Domain / Project Area</label>
                  <select value={offerForm.domain} onChange={e => setOfferForm(p => ({ ...p, domain: e.target.value }))}>
                    {DOMAINS.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <button type="submit" className="btn btn-primary w-full" disabled={sendingOffer} style={{ justifyContent: 'center', gap: 8 }}>
                  {sendingOffer ? <span className="spinner" /> : <><Send size={16} /> Send Offer Letter</>}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ── Tab: Assign Mentor ──────────────────────────────────────────── */}
        {activeTab === 'Assign Mentor' && (
          <div style={{ maxWidth: 560, margin: '0 auto' }}>
            <div className="card" style={{ padding: 32 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(52,211,153,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <UserCheck size={20} style={{ color: 'var(--clr-success)' }} />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Assign / Reassign Mentor</h2>
                  <p className="text-sm text-muted">Allocate or change the mentor for an active internship.</p>
                </div>
              </div>

              <form onSubmit={handleAssignMentor} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="form-group">
                  <label>Select Internship *</label>
                  <select value={assignForm.internshipId} onChange={e => setAssignForm(p => ({ ...p, internshipId: e.target.value }))} required>
                    <option value="">— Choose internship —</option>
                    {internships.map(ilm => (
                      <option key={ilm._id} value={ilm._id}>
                        {ilm.intern?.profile?.firstName} {ilm.intern?.profile?.lastName} — {ilm.status}
                        {ilm.mentor ? ` (Mentor: ${ilm.mentor?.profile?.firstName})` : ' (No Mentor)'}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Assign Mentor *</label>
                  <select value={assignForm.mentorId} onChange={e => setAssignForm(p => ({ ...p, mentorId: e.target.value }))} required>
                    <option value="">— Choose a mentor —</option>
                    {admins.map(u => (
                      <option key={u._id} value={u._id}>
                        {u.profile?.firstName} {u.profile?.lastName} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>

                <button type="submit" className="btn btn-primary w-full" disabled={assigning} style={{ justifyContent: 'center', gap: 8 }}>
                  {assigning ? <span className="spinner" /> : <><UserCheck size={16} /> Assign Mentor</>}
                </button>
              </form>

              {/* Summary table */}
              {internships.length > 0 && (
                <div style={{ marginTop: 28 }}>
                  <h4 style={{ fontWeight: 700, marginBottom: 12, fontSize: '0.9rem' }}>Current Assignments</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {internships.map(ilm => (
                      <div key={ilm._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--clr-surface-2)', borderRadius: 'var(--r-sm)', fontSize: '0.85rem' }}>
                        <span style={{ fontWeight: 600 }}>{ilm.intern?.profile?.firstName} {ilm.intern?.profile?.lastName}</span>
                        {ilm.mentor
                          ? <span className="badge badge-green">{ilm.mentor?.profile?.firstName} {ilm.mentor?.profile?.lastName}</span>
                          : <span className="badge badge-yellow">No Mentor</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Tab: Offer Transactions ──────────────────────────────────────── */}
        {activeTab === 'Offer Transactions' && (
          <div>
            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, marginBottom: 28 }}>
              {[
                { label: 'Total Offers',  value: txStats.total,     color: 'var(--clr-primary)', icon: <ListChecks size={16} /> },
                { label: 'Pending',       value: txStats.sent,      color: '#f59e0b',             icon: <Clock size={16} /> },
                { label: 'Accepted',      value: txStats.accepted,  color: 'var(--clr-success)',  icon: <CheckCircle2 size={16} /> },
                { label: 'Active Interns',value: txStats.active,    color: 'var(--clr-accent)',   icon: <TrendingUp size={16} /> },
                { label: 'Declined',      value: txStats.rejected,  color: 'var(--clr-danger)',   icon: <XCircle size={16} /> },
                { label: 'Completed',     value: txStats.completed, color: '#6b7280',             icon: <Award size={16} /> },
              ].map(s => (
                <div key={s.label} className="metric-card" style={{ '--metric-color': s.color }}>
                  <div className="metric-icon" style={{ color: s.color }}>{s.icon}</div>
                  <div className="metric-value">{s.value}</div>
                  <div className="metric-label">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Transactions table */}
            {loading ? (
              <div className="skeleton" style={{ height: 300, borderRadius: 'var(--r-sm)' }} />
            ) : internships.length === 0 ? (
              <div className="empty-state">
                <ListChecks size={48} style={{ color: 'var(--clr-text-3)', marginBottom: 16 }} />
                <h3>No Offers Sent Yet</h3>
                <p>Go to "Send Offer" tab to send your first internship offer.</p>
              </div>
            ) : (
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--clr-surface-2)', borderBottom: '1px solid var(--clr-border)' }}>
                        {['Candidate', 'Email', 'Mentor', 'Offer Status', 'Internship Status', 'Start Date', 'Stipend'].map(h => (
                          <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--clr-text-3)', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {internships.map((ilm, idx) => (
                        <tr key={ilm._id} style={{ borderBottom: '1px solid var(--clr-border)', background: idx % 2 === 0 ? 'transparent' : 'var(--clr-surface-2)' }}>
                          <td style={{ padding: '12px 16px', fontWeight: 600, fontSize: '0.88rem' }}>
                            {ilm.intern?.profile?.firstName} {ilm.intern?.profile?.lastName}
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: '0.82rem', color: 'var(--clr-text-2)' }}>
                            {ilm.intern?.email}
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: '0.82rem' }}>
                            {ilm.mentor
                              ? `${ilm.mentor?.profile?.firstName} ${ilm.mentor?.profile?.lastName}`
                              : <span style={{ color: 'var(--clr-warning)' }}>—</span>}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span className={`badge ${ilm.offerStatus === 'ACCEPTED' ? 'badge-green' : ilm.offerStatus === 'REJECTED' ? 'badge-red' : 'badge-yellow'}`}>
                              {ilm.offerStatus || 'PENDING'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span className={`badge ${STATUS_COLORS[ilm.status] || 'badge-gray'}`}>
                              {ilm.status}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: '0.82rem', color: 'var(--clr-text-2)' }}>
                            {ilm.startDate ? new Date(ilm.startDate).toLocaleDateString('en-IN') : '—'}
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: '0.82rem', fontWeight: 600, color: 'var(--clr-success)' }}>
                            ₹{(ilm.stipend?.amount || 0).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
