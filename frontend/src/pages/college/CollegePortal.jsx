import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useCollegeAuth } from '../../context/CollegeAuthContext';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function CollegeSidebar({ college, activeTab, setActiveTab, onLogout }) {
  const tabs = [
    { id: 'overview',    icon: '🏠', label: 'Overview' },
    { id: 'drives',      icon: '📋', label: 'Drives & JDs' },
    { id: 'applications',icon: '📄', label: 'Applications' },
    { id: 'shortlisted', icon: '✅', label: 'Shortlisted' },
    { id: 'selected',    icon: '🏆', label: 'Selected' },
    { id: 'internships', icon: '📈', label: 'Internships' },
  ];
  return (
    <aside className="college-portal-sidebar">
      <div className="college-portal-sidebar-header">
        <div className="college-portal-logo">
          {college?.logo
            ? <img src={college.logo} alt={college.name} />
            : <span className="college-portal-logo-icon">🎓</span>
          }
        </div>
        <div>
          <div className="college-portal-name">{college?.code || college?.name}</div>
          <div className="college-portal-university">{college?.university} University</div>
        </div>
      </div>
      <nav className="college-portal-nav">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`college-portal-nav-item ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="college-nav-icon">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>
      <div className="college-portal-sidebar-footer">
        <div className="college-tpo-info">
          <span>👤 {college?.tpo?.name || 'TPO'}</span>
          <span className="college-tpo-email">{college?.tpo?.email}</span>
        </div>
        <button className="college-logout-btn" onClick={onLogout}>🚪 Logout</button>
      </div>
    </aside>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────
function OverviewTab({ college, drives }) {
  const totalApplicants = drives.reduce((s, d) => s + (d.totalApplicants || 0), 0);
  const totalShortlisted = drives.reduce((s, d) => s + (d.totalShortlisted || 0), 0);
  const totalSelected = drives.reduce((s, d) => s + (d.totalSelected || 0), 0);

  const stats = [
    { label: 'Total Drives', value: drives.length, icon: '📋', color: 'blue' },
    { label: 'Total Applicants', value: totalApplicants, icon: '📄', color: 'purple' },
    { label: 'Shortlisted', value: totalShortlisted, icon: '✅', color: 'orange' },
    { label: 'Selected as Interns', value: totalSelected, icon: '🏆', color: 'green' },
  ];

  return (
    <div className="college-portal-content">
      <div className="college-portal-welcome">
        <h1>Welcome back, <span className="college-name-accent">{college?.code || college?.name}</span> 👋</h1>
        <p>{college?.address} • {college?.city} • <a href={college?.website} target="_blank" rel="noreferrer">{college?.website}</a></p>
      </div>

      <div className="college-stats-grid">
        {stats.map(s => (
          <div key={s.label} className={`college-stat-card stat-${s.color}`}>
            <div className="college-stat-icon">{s.icon}</div>
            <div className="college-stat-value">{s.value}</div>
            <div className="college-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Recent Drives */}
      <div className="college-section-card">
        <h2 className="college-section-title">Recent Drives</h2>
        {drives.length === 0 ? (
          <div className="college-empty-state">
            <span>📭</span>
            <p>No drives yet. Your admin will send a JD soon!</p>
          </div>
        ) : (
          <div className="college-drives-list">
            {drives.slice(0, 5).map(drive => (
              <DriveCard key={drive._id} drive={drive} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Drive Card Component ─────────────────────────────────────────────────────
function DriveCard({ drive, onClick }) {
  const statusColors = {
    DRAFT: 'grey', JD_SENT: 'blue', APPLICATIONS_OPEN: 'green',
    SHORTLISTING: 'orange', SHORTLISTED: 'teal', FURTHER_ROUNDS: 'purple',
    COMPLETED: 'dark', CANCELLED: 'red',
  };
  return (
    <div className={`college-drive-card ${onClick ? 'clickable' : ''}`} onClick={onClick}>
      <div className="college-drive-card-left">
        <div className={`college-drive-status status-${statusColors[drive.status] || 'grey'}`}>
          {drive.status?.replace(/_/g, ' ')}
        </div>
        <h3 className="college-drive-title">{drive.title}</h3>
        <div className="college-drive-meta">
          <span>📅 {drive.driveDate ? new Date(drive.driveDate).toLocaleDateString('en-IN') : 'TBD'}</span>
          <span>📍 {drive.venue || drive.mode}</span>
          <span>💼 {drive.jd?.role || 'Internship'}</span>
        </div>
      </div>
      <div className="college-drive-card-right">
        <div className="college-drive-stat"><strong>{drive.totalApplicants || 0}</strong><span>Applied</span></div>
        <div className="college-drive-stat"><strong>{drive.totalShortlisted || 0}</strong><span>Shortlisted</span></div>
        <div className="college-drive-stat"><strong>{drive.totalSelected || 0}</strong><span>Selected</span></div>
      </div>
    </div>
  );
}

// ─── Applications Tab ─────────────────────────────────────────────────────────
function ApplicationsTab({ drives, collegeId }) {
  const [selectedDrive, setSelectedDrive] = useState(null);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('overallScore');
  const { token } = useCollegeAuth();

  const fetchApps = useCallback(async (driveId) => {
    setLoading(true);
    try {
      const { data } = await axios.get(
        `${API}/college/portal/drives/${driveId}/applications`,
        { headers: { Authorization: `Bearer ${token}` }, withCredentials: true }
      );
      setApplications(data.applications || []);
    } catch (err) {
      toast.error('Failed to load applications');
    } finally {
      setLoading(false);
    }
  }, [token]);

  const filtered = applications
    .filter(a =>
      a.student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.student.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.student.branch?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => (b[sortBy] || 0) - (a[sortBy] || 0));

  return (
    <div className="college-portal-content">
      <h1 className="college-page-title">📄 Student Applications</h1>

      {/* Drive selector */}
      <div className="college-drive-selector">
        {drives.map(d => (
          <button
            key={d._id}
            className={`college-drive-selector-btn ${selectedDrive?._id === d._id ? 'active' : ''}`}
            onClick={() => { setSelectedDrive(d); fetchApps(d._id); }}
          >
            {d.title}
            <span className="drive-count">{d.totalApplicants || 0}</span>
          </button>
        ))}
      </div>

      {selectedDrive && (
        <>
          {/* Filters */}
          <div className="college-filter-bar">
            <input
              type="text"
              placeholder="🔍 Search by name, email or branch..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="college-search-input"
            />
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="college-sort-select">
              <option value="overallScore">Sort by Overall Score</option>
              <option value="atsScore">Sort by ATS Score</option>
              <option value="student.cgpa">Sort by CGPA</option>
              <option value="createdAt">Sort by Date Applied</option>
            </select>
          </div>

          {/* Table */}
          {loading ? (
            <div className="college-loading">Loading applications...</div>
          ) : filtered.length === 0 ? (
            <div className="college-empty-state">
              <span>📭</span><p>No applications yet.</p>
            </div>
          ) : (
            <div className="college-table-wrap">
              <table className="college-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Student</th>
                    <th>Branch</th>
                    <th>CGPA</th>
                    <th>10th %</th>
                    <th>12th %</th>
                    <th>ATS Score</th>
                    <th>Overall</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((app, i) => (
                    <ApplicationRow key={app._id} app={app} index={i + 1} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {!selectedDrive && (
        <div className="college-empty-state">
          <span>👆</span><p>Select a drive above to view applications.</p>
        </div>
      )}
    </div>
  );
}

function ApplicationRow({ app, index }) {
  const statusColors = {
    APPLIED: 'grey', UNDER_REVIEW: 'blue', SHORTLISTED: 'green',
    REJECTED: 'red', ROUND_2: 'orange', ROUND_3: 'purple',
    SELECTED: 'teal', OFFER_SENT: 'dark',
  };
  return (
    <tr className="college-table-row">
      <td>{index}</td>
      <td>
        <div className="applicant-name">{app.student.name}</div>
        <div className="applicant-email">{app.student.email}</div>
      </td>
      <td>{app.student.branch || '—'}</td>
      <td>
        <span className={`cgpa-badge ${app.student.cgpa >= 8 ? 'high' : app.student.cgpa >= 6.5 ? 'mid' : 'low'}`}>
          {app.student.cgpa?.toFixed(2) || '—'}
        </span>
      </td>
      <td>{app.student.class10 ? `${app.student.class10}%` : '—'}</td>
      <td>{app.student.class12 ? `${app.student.class12}%` : '—'}</td>
      <td>
        <div className="score-bar-wrap">
          <div className="score-bar" style={{ width: `${app.atsScore || 0}%`, background: `hsl(${(app.atsScore || 0) * 1.2}, 70%, 50%)` }} />
          <span>{app.atsScore ?? '—'}</span>
        </div>
      </td>
      <td>
        <span className="overall-score">{app.overallScore ?? '—'}</span>
      </td>
      <td>
        <span className={`status-badge status-${statusColors[app.status] || 'grey'}`}>
          {app.status?.replace(/_/g, ' ')}
        </span>
      </td>
    </tr>
  );
}

// ─── Shortlisted Tab ──────────────────────────────────────────────────────────
function ShortlistedTab({ drives }) {
  const [selectedDrive, setSelectedDrive] = useState(null);
  const [shortlisted, setShortlisted] = useState([]);
  const [loading, setLoading] = useState(false);
  const { token } = useCollegeAuth();

  const fetchShortlisted = useCallback(async (driveId) => {
    setLoading(true);
    try {
      const { data } = await axios.get(
        `${API}/college/portal/drives/${driveId}/shortlisted`,
        { headers: { Authorization: `Bearer ${token}` }, withCredentials: true }
      );
      setShortlisted(data.shortlisted || []);
    } catch {
      toast.error('Failed to load shortlisted students');
    } finally {
      setLoading(false);
    }
  }, [token]);

  return (
    <div className="college-portal-content">
      <h1 className="college-page-title">✅ Shortlisted Students</h1>

      <div className="college-drive-selector">
        {drives.map(d => (
          <button
            key={d._id}
            className={`college-drive-selector-btn ${selectedDrive?._id === d._id ? 'active' : ''}`}
            onClick={() => { setSelectedDrive(d); fetchShortlisted(d._id); }}
          >
            {d.title}
            <span className="drive-count">{d.totalShortlisted || 0}</span>
          </button>
        ))}
      </div>

      {selectedDrive && (
        <>
          {loading ? (
            <div className="college-loading">Loading...</div>
          ) : shortlisted.length === 0 ? (
            <div className="college-empty-state">
              <span>⏳</span><p>No shortlisted students yet. Shortlisting may be in progress.</p>
            </div>
          ) : (
            <>
              <div className="college-shortlist-header">
                <span className="shortlist-count">{shortlisted.length} students shortlisted</span>
                <button className="btn-download" onClick={() => {
                  const csv = [
                    ['Name','Email','Branch','CGPA','10th %','12th %','ATS Score','Overall Score','Status'],
                    ...shortlisted.map(a => [
                      a.student.name, a.student.email, a.student.branch,
                      a.student.cgpa, a.student.class10, a.student.class12,
                      a.atsScore, a.overallScore, a.status,
                    ])
                  ].map(r => r.join(',')).join('\n');
                  const blob = new Blob([csv], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url; a.download = `shortlisted_${selectedDrive.title}.csv`; a.click();
                }}>
                  ⬇️ Download CSV
                </button>
              </div>
              <div className="college-table-wrap">
                <table className="college-table">
                  <thead>
                    <tr>
                      <th>#</th><th>Student</th><th>Branch</th><th>CGPA</th>
                      <th>ATS</th><th>Overall</th><th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shortlisted.map((app, i) => (
                      <ApplicationRow key={app._id} app={app} index={i + 1} />
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

// ─── Selected Tab ─────────────────────────────────────────────────────────────
function SelectedTab({ drives }) {
  const [selectedDrive, setSelectedDrive] = useState(null);
  const [selected, setSelected] = useState([]);
  const { token } = useCollegeAuth();

  const fetchSelected = useCallback(async (driveId) => {
    try {
      const { data } = await axios.get(
        `${API}/college/portal/drives/${driveId}/shortlisted`,
        { headers: { Authorization: `Bearer ${token}` }, withCredentials: true }
      );
      setSelected((data.shortlisted || []).filter(a => ['SELECTED', 'OFFER_SENT'].includes(a.status)));
    } catch { toast.error('Failed to load'); }
  }, [token]);

  return (
    <div className="college-portal-content">
      <h1 className="college-page-title">🏆 Selected Students</h1>
      <p className="college-subtitle">These students have been selected and issued internship offers.</p>

      <div className="college-drive-selector">
        {drives.map(d => (
          <button
            key={d._id}
            className={`college-drive-selector-btn ${selectedDrive?._id === d._id ? 'active' : ''}`}
            onClick={() => { setSelectedDrive(d); fetchSelected(d._id); }}
          >
            {d.title}
            <span className="drive-count">{d.totalSelected || 0}</span>
          </button>
        ))}
      </div>

      {selectedDrive && (
        selected.length === 0 ? (
          <div className="college-empty-state">
            <span>🎯</span><p>No students have been finalized yet.</p>
          </div>
        ) : (
          <div className="college-selected-cards">
            {selected.map(app => (
              <div key={app._id} className="college-selected-card">
                <div className="selected-avatar">
                  {app.student.name.charAt(0).toUpperCase()}
                </div>
                <div className="selected-info">
                  <div className="selected-name">{app.student.name}</div>
                  <div className="selected-email">{app.student.email}</div>
                  <div className="selected-meta">
                    <span>🎓 {app.student.branch}</span>
                    <span>📊 CGPA: {app.student.cgpa}</span>
                    <span>🏷️ {app.status.replace(/_/g, ' ')}</span>
                  </div>
                </div>
                <div className="selected-score-badge">
                  <span>{app.overallScore}</span>
                  <small>Overall</small>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

// ─── Drives Tab ───────────────────────────────────────────────────────────────
function DrivesTab({ drives }) {
  return (
    <div className="college-portal-content">
      <h1 className="college-page-title">📋 Drives & Job Descriptions</h1>
      {drives.length === 0 ? (
        <div className="college-empty-state">
          <span>📭</span>
          <p>No drives assigned yet. The HireStorm team will send a JD when a drive is planned for your campus.</p>
        </div>
      ) : (
        <div className="college-drives-full">
          {drives.map(drive => (
            <div key={drive._id} className="college-drive-detail-card">
              <div className="drive-detail-header">
                <div>
                  <h3>{drive.title}</h3>
                  <p>{drive.description}</p>
                </div>
                <span className={`college-drive-status status-blue`}>{drive.status?.replace(/_/g, ' ')}</span>
              </div>
              {drive.jd && (
                <div className="drive-jd-section">
                  <h4>📄 Job Description</h4>
                  <div className="drive-jd-grid">
                    <div><strong>Role:</strong> {drive.jd.role}</div>
                    <div><strong>Duration:</strong> {drive.jd.duration}</div>
                    <div><strong>Stipend:</strong> ₹{drive.jd.stipend?.toLocaleString()}/mo</div>
                    <div><strong>Min CGPA:</strong> {drive.jd.minCGPA}</div>
                    <div><strong>Eligibility:</strong> {drive.jd.eligibility}</div>
                    <div><strong>Branches:</strong> {drive.jd.branches?.join(', ')}</div>
                  </div>
                  {drive.jd.skills?.length > 0 && (
                    <div className="drive-jd-skills">
                      <strong>Skills Required:</strong>
                      <div className="skill-tags">
                        {drive.jd.skills.map(s => <span key={s} className="skill-tag">{s}</span>)}
                      </div>
                    </div>
                  )}
                  {drive.jd.description && (
                    <div className="drive-jd-desc">
                      <strong>Details:</strong>
                      <p>{drive.jd.description}</p>
                    </div>
                  )}
                </div>
              )}
              {drive.applicationFormUrl && (
                <div className="drive-form-section">
                  <strong>📎 Application Form Link (Share with students):</strong>
                  <div className="form-link-box">
                    <span>{drive.applicationFormUrl}</span>
                    <button onClick={() => {
                      navigator.clipboard.writeText(drive.applicationFormUrl);
                      toast.success('Link copied!');
                    }}>📋 Copy</button>
                  </div>
                </div>
              )}
              <div className="drive-detail-stats">
                <span>👥 {drive.totalApplicants || 0} Applied</span>
                <span>✅ {drive.totalShortlisted || 0} Shortlisted</span>
                <span>🏆 {drive.totalSelected || 0} Selected</span>
                <span>📅 {drive.driveDate ? new Date(drive.driveDate).toLocaleDateString('en-IN') : 'TBD'}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InternshipsTab({ token }) {
  const [internships, setInternships] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/college/portal/internships`, {
      headers: { Authorization: `Bearer ${token}` },
      withCredentials: true,
    }).then(({ data }) => setInternships(data.internships || []))
      .catch(() => toast.error('Failed to load internships'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="college-portal-content"><div className="college-loading">Loading internships...</div></div>;
  return (
    <div className="college-portal-content">
      <h1 className="college-page-title">📈 Internship Participation</h1>
      <p className="college-subtitle">Monitor internship progress for students associated with your college.</p>
      {internships.length === 0 ? <div className="college-empty-state"><span>📭</span><p>No internship participation yet.</p></div> : (
        <div className="college-table-wrap">
          <table className="college-table">
            <thead><tr><th>Student</th><th>Cohort</th><th>Company</th><th>Mentor</th><th>Status</th><th>Logs</th><th>CA Score</th></tr></thead>
            <tbody>{internships.map(internship => (
              <tr key={internship._id} className="college-table-row">
                <td><div className="applicant-name">{internship.intern?.profile?.firstName} {internship.intern?.profile?.lastName}</div><div className="applicant-email">{internship.intern?.email}</div></td>
                <td>{internship.cohort || '—'}</td>
                <td>{internship.company?.name || 'HireStorm'}</td>
                <td>{internship.mentor ? `${internship.mentor.profile?.firstName || ''} ${internship.mentor.profile?.lastName || ''}`.trim() : 'Unassigned'}</td>
                <td><span className="status-badge status-blue">{internship.status?.replace(/_/g, ' ')}</span></td>
                <td>{internship.dailyLogs?.length || 0}</td>
                <td>{Math.round(internship.continuousAssessmentScore || 0)}/100</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main Portal Page ─────────────────────────────────────────────────────────
export default function CollegePortal() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { college, token, logout } = useCollegeAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [drives, setDrives] = useState([]);
  const [loadingDrives, setLoadingDrives] = useState(true);

  // Auth guard — if no college session or wrong slug, redirect to college login
  useEffect(() => {
    if (!college || !token) {
      navigate('/college/login');
      return;
    }
    if (college.slug !== slug) {
      navigate(`/college/${college.slug}`);
    }
  }, [college, token, slug, navigate]);

  // Fetch drives
  const fetchDrives = useCallback(async () => {
    if (!token) return;
    setLoadingDrives(true);
    try {
      const { data } = await axios.get(`${API}/college/portal/drives`, {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true,
      });
      setDrives(data.drives || []);
    } catch {
      toast.error('Failed to load drives');
    } finally {
      setLoadingDrives(false);
    }
  }, [token]);

  useEffect(() => { fetchDrives(); }, [fetchDrives]);

  const handleLogout = async () => {
    await logout();
    navigate('/college/login');
  };

  if (!college) return null;

  const tabs = {
    overview:     <OverviewTab college={college} drives={drives} />,
    drives:       <DrivesTab drives={drives} />,
    applications: <ApplicationsTab drives={drives} collegeId={college._id} />,
    shortlisted:  <ShortlistedTab drives={drives} />,
    selected:     <SelectedTab drives={drives} />,
    internships: <InternshipsTab token={token} />,
  };

  return (
    <div className="college-portal-layout">
      <CollegeSidebar
        college={college}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={handleLogout}
      />
      <main className="college-portal-main">
        {loadingDrives && activeTab === 'overview' ? (
          <div className="college-full-loading">
            <div className="college-spinner" />
            <p>Loading your portal...</p>
          </div>
        ) : (
          tabs[activeTab]
        )}
      </main>
    </div>
  );
}
