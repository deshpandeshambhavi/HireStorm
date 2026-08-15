import { useEffect, useState } from 'react';
import StudentLayout from '../../layouts/StudentLayout';
import useAuthStore from '../../store/authStore';
import api from '../../api/axios';
import {
  Briefcase, Code2, BookOpen, Star, TrendingUp, Clock, CheckCircle2,
  XCircle, FileText, ChevronRight, AlertCircle, Award, Calendar,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import InternshipHeatmap from '../../components/InternshipHeatmap';

export default function StudentDashboard() {
  const { user, refreshUser } = useAuthStore();
  const navigate = useNavigate();

  const [recentApps, setRecentApps]       = useState([]);
  const [pendingOffer, setPendingOffer]   = useState(null);  // internship with OFFER_SENT
  const [activeInternship, setActiveInternship] = useState(null); // ACTIVE internship
  const [hackathonCount, setHackathonCount] = useState(0);
  const [loading, setLoading]             = useState(true);
  const [offerLoading, setOfferLoading]   = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        // Fetch apps, internship data, and hackathon teams in parallel
        const [appsRes, ilmRes, teamsRes] = await Promise.all([
          api.get('/applications/my').catch(() => ({ data: { data: [] } })),
          api.get('/ilm/my').catch(() => ({ data: { data: null } })),
          api.get('/hackathons/my-teams').catch(() => ({ data: { data: [] } })),
        ]);

        const apps = appsRes.data.data || [];
        setRecentApps(apps.slice(0, 5));

        // Count unique hackathons the student has registered for
        const teams = teamsRes.data?.data || [];
        setHackathonCount(teams.length);

        const ilm = ilmRes.data?.data;
        if (ilm) {
          if (ilm.offerStatus === 'PENDING' || ilm.status === 'OFFER_SENT') {
            setPendingOffer(ilm);
          } else if (ilm.status === 'ACTIVE' || ilm.status === 'COMPLETED') {
            setActiveInternship(ilm);
          }
        }
      } catch (err) {
        console.error('[Dashboard load]', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleAcceptOffer = async () => {
    setOfferLoading(true);
    try {
      await api.post('/ilm/offer/accept');
      toast.success('🎉 Offer accepted! Your internship is now active.');
      // Refresh user token to get new INTERN role, then navigate to ILM dashboard
      await refreshUser().catch(() => {});
      window.location.replace('/ilm');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to accept offer');
      setOfferLoading(false);
    }
  };

  const handleDeclineOffer = async () => {
    if (!window.confirm('Are you sure you want to decline this internship offer?')) return;
    setOfferLoading(true);
    try {
      // Mark as rejected
      await api.post('/ilm/offer/decline').catch(() => {});
      toast.success('Offer declined.');
      setPendingOffer(null);
    } catch {
      // Even if endpoint doesn't exist, clear the UI
      setPendingOffer(null);
    } finally { setOfferLoading(false); }
  };

  const isIntern = user?.role === 'INTERN';
  const isPro    = ['PRO_STUDENT', 'INTERN'].includes(user?.role);

  const todayLog = activeInternship?.dailyLogs?.find(l => {
    const d = new Date(l.date);
    const t = new Date();
    return d.toDateString() === t.toDateString();
  });
  const submittedToday = !!todayLog;

  const progressDays = activeInternship?.startDate
    ? Math.floor((new Date() - new Date(activeInternship.startDate)) / (24 * 60 * 60 * 1000))
    : 0;
  const ilmProgress = Math.min(100, Math.round((progressDays / 90) * 100));

  return (
    <StudentLayout>
      <div className="page">
        <div className="page-header">
          <h1>Welcome back, {user?.profile?.firstName} 👋</h1>
          <p className="text-muted">Here's what's happening with your career journey</p>
        </div>

        {/* ── PRO Upsell (hidden for interns) ───────────────────── */}
        {!isPro && !pendingOffer && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(139,92,246,0.12), rgba(59,130,246,0.08))',
            border: '1px solid rgba(139,92,246,0.25)', borderRadius: 'var(--r-md)',
            padding: '14px 20px', marginBottom: 24,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
          }}>
            <div>
              <div style={{ fontWeight: 700, marginBottom: 3 }}>⚡ Upgrade to PRO</div>
              <div className="text-sm text-muted">Get early access, profile highlighting, analytics, and more.</div>
            </div>
            <Link to="/settings/subscription">
              <button className="btn btn-primary btn-sm">Go PRO — ₹299/mo</button>
            </Link>
          </div>
        )}

        {/* ── OFFER BANNER ───────────────────────────────────────── */}
        {pendingOffer && (
          <div className="card animate-fade-in" style={{
            padding: 28, marginBottom: 28,
            background: 'linear-gradient(135deg, rgba(52,211,153,0.08), rgba(16,185,129,0.04))',
            border: '2px solid var(--clr-success)',
            boxShadow: '0 0 0 4px rgba(52,211,153,0.08)',
          }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{
                width: 52, height: 52, borderRadius: 14, flexShrink: 0,
                background: 'rgba(52,211,153,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
              }}>🎉</div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontWeight: 900, fontSize: '1.2rem', color: 'var(--clr-success)', marginBottom: 6 }}>
                  You have an Internship Offer!
                </h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--clr-text-2)', marginBottom: 14, lineHeight: 1.6 }}>
                  Congratulations! You've been selected for a <strong>{pendingOffer.durationDays || 90}-Day Paid Internship</strong> at
                  {' '}<strong>{pendingOffer.company?.name || 'HireStorm'}</strong>.
                  Stipend: <strong>₹{(pendingOffer.stipend?.amount || 10000).toLocaleString()}/month</strong>.
                  {pendingOffer.startDate && (
                    <> Start date: <strong>{new Date(pendingOffer.startDate).toDateString()}</strong>.</>
                  )}
                </p>

                {pendingOffer.offerLetterUrl && (
                  <a
                    href={pendingOffer.offerLetterUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-outline btn-sm"
                    style={{ marginBottom: 16, gap: 6 }}
                  >
                    <FileText size={14} /> View Offer Letter (PDF)
                  </a>
                )}

                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-primary"
                    onClick={handleAcceptOffer}
                    disabled={offerLoading}
                    style={{ gap: 8 }}
                  >
                    {offerLoading
                      ? <span className="spinner" />
                      : <><CheckCircle2 size={16} /> Accept Offer</>}
                  </button>
                  <button
                    className="btn btn-ghost"
                    onClick={handleDeclineOffer}
                    disabled={offerLoading}
                    style={{ color: 'var(--clr-danger)', gap: 6 }}
                  >
                    <XCircle size={15} /> Decline
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── ACTIVE INTERNSHIP CARD ─────────────────────────────── */}
        {(isIntern || activeInternship) && !pendingOffer && (
          <div className="card" style={{
            marginBottom: 28, padding: 24,
            background: 'linear-gradient(135deg, rgba(79,126,248,0.06), rgba(139,92,246,0.04))',
            border: '1px solid rgba(79,126,248,0.3)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 12,
                  background: 'rgba(79,126,248,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
                }}>🎓</div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>Active Internship</div>
                  <div className="text-sm text-muted">
                    {activeInternship?.company?.name || 'HireStorm'} ·
                    Day {progressDays} of 90 ·
                    Stipend ₹{(activeInternship?.stipend?.amount || 10000).toLocaleString()}/mo
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Link to="/ilm/daily-log">
                  <button
                    className={`btn ${submittedToday ? 'btn-ghost' : 'btn-primary'} btn-sm`}
                    style={{ gap: 6 }}
                    disabled={submittedToday}
                  >
                    <Clock size={14} />
                    {submittedToday ? '✅ Log Submitted Today' : 'Submit Daily Log'}
                  </button>
                </Link>
                <Link to="/ilm">
                  <button className="btn btn-outline btn-sm" style={{ gap: 6 }}>
                    <Star size={14} /> Internship Portal
                  </button>
                </Link>
              </div>
            </div>

            {/* Progress Bar */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.8rem', color: 'var(--clr-text-2)' }}>
                <span>Progress</span>
                <span style={{ fontWeight: 700 }}>{ilmProgress}% complete</span>
              </div>
              <div style={{ height: 8, background: 'var(--clr-surface-2)', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${ilmProgress}%`,
                  background: 'linear-gradient(90deg, var(--clr-primary), var(--clr-accent))',
                  borderRadius: 8, transition: 'width 0.6s ease',
                }} />
              </div>
              {/* Quick stats row */}
              <div style={{ display: 'flex', gap: 20, marginTop: 14, fontSize: '0.82rem' }}>
                {[
                  { label: 'Daily Logs', value: activeInternship?.dailyLogs?.filter(l => l.status !== 'PENDING').length || 0, color: 'var(--clr-primary)' },
                  { label: 'CA Score', value: `${Math.round(activeInternship?.continuousAssessmentScore || 0)}/100`, color: 'var(--clr-success)' },
                  { label: 'Reviews Done', value: `${activeInternship?.monthlyReviews?.filter(r => r.status === 'COMPLETED').length || 0}/3`, color: 'var(--clr-warning)' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span className="text-muted">{label}:</span>
                    <span style={{ fontWeight: 700, color }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── INTERNSHIP ACTIVITY HEATMAP ───────────────────────── */}
        {activeInternship && !pendingOffer && (
          <InternshipHeatmap internship={activeInternship} />
        )}

        {/* ── Stat Cards ────────────────────────────────────────── */}
        <div className="grid-4" style={{ marginBottom: 28 }}>
          {[
            { icon: <Briefcase size={20} />, label: 'Applications', value: recentApps.length,   clr: 'var(--clr-primary)', link: '/my-applications' },
            { icon: <Code2 size={20} />,     label: 'Hackathons',   value: hackathonCount,     clr: 'var(--clr-accent)',   link: '/hackathons' },
            { icon: <Star size={20} />,      label: 'Profile Views', value: isPro ? (user?.profileViews?.length || 0) : '—', clr: 'var(--clr-warning)', link: isPro ? '/profile' : '/settings/subscription' },
          ].map(({ icon, label, value, clr, link }) => (
            <Link to={link} key={label} style={{ textDecoration: 'none' }}>
              <div className="card stat-card" style={{ cursor: 'pointer' }}>
                <div className="stat-icon" style={{ background: `${clr}1A` }}>
                  <div style={{ color: clr }}>{icon}</div>
                </div>
                <div className="stat-value">{value}</div>
                <div className="stat-label">{label}</div>
              </div>
            </Link>
          ))}
        </div>

        {/* ── Bottom Grid ───────────────────────────────────────── */}
        <div className="grid-2">
          {/* Recent Applications */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h3 style={{ fontWeight: 700 }}>Recent Applications</h3>
              <Link to="/my-applications" className="text-sm" style={{ color: 'var(--clr-primary)' }}>View all</Link>
            </div>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 48, borderRadius: 6 }} />)}
              </div>
            ) : recentApps.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px 0' }}>
                <Briefcase size={32} style={{ marginBottom: 10, color: 'var(--clr-text-3)' }} />
                <p className="text-muted">No applications yet</p>
                <Link to="/listings"><button className="btn btn-primary btn-sm" style={{ marginTop: 10 }}>Browse Jobs</button></Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {recentApps.map(app => (
                  <div key={app._id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 0', borderBottom: '1px solid var(--clr-border)',
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{app.listing?.title || 'Position'}</div>
                      <div className="text-xs text-muted">{new Date(app.appliedAt).toLocaleDateString('en-IN')}</div>
                    </div>
                    <span className={`badge ${
                      app.status === 'APPLIED' ? 'badge-blue' :
                      app.status === 'SHORTLISTED' ? 'badge-green' :
                      app.status === 'REJECTED' ? 'badge-red' : 'badge-yellow'
                    }`}>{app.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="card">
            <h3 style={{ fontWeight: 700, marginBottom: 16 }}>Quick Actions</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                ...(isIntern ? [
                  { icon: <Clock size={15} />,    label: 'Submit Daily Log',        link: '/ilm/daily-log',  clr: 'var(--clr-primary)',  hot: !submittedToday },
                  { icon: <Star size={15} />,     label: 'Internship Dashboard',    link: '/ilm',            clr: 'var(--clr-success)' },
                  { icon: <Calendar size={15} />, label: 'Work Breakdown (WBS)',    link: '/ilm/wbs',        clr: 'var(--clr-accent)' },
                  { icon: <Award size={15} />,    label: 'My Certificate',          link: '/ilm/certificate', clr: '#f59e0b' },
                ] : [
                  { icon: <Briefcase size={15} />, label: 'Browse Jobs & Internships', link: '/listings',   clr: 'var(--clr-primary)' },
                  { icon: <Code2 size={15} />,     label: 'Join a Hackathon',          link: '/hackathons', clr: 'var(--clr-accent)' },
                  { icon: <TrendingUp size={15} />, label: 'Update My Profile',        link: '/profile',    clr: '#f59e0b' },
                ]),
              ].map(({ icon, label, link, clr, hot }) => (
                <Link to={link} key={link}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 14px', borderRadius: 'var(--r-sm)',
                    background: hot ? `${clr}12` : 'var(--clr-surface-2)',
                    border: hot ? `1px solid ${clr}30` : '1px solid transparent',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}>
                    <div style={{ color: clr }}>{icon}</div>
                    <span style={{ fontSize: '0.875rem', fontWeight: hot ? 700 : 500, color: hot ? clr : 'var(--clr-text)' }}>
                      {label}
                    </span>
                    {hot && (
                      <span className="badge badge-blue" style={{ marginLeft: 'auto', fontSize: '0.65rem' }}>Action needed</span>
                    )}
                    <ChevronRight size={14} style={{ color: 'var(--clr-text-3)', marginLeft: hot ? 0 : 'auto' }} />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </StudentLayout>
  );
}
