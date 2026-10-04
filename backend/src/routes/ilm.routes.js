const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { allowRoles } = require('../middleware/rbac');

const {
  sendOffer, acceptOffer, getMyInternship,
  getMentoringInternships, submitMonthlyReview,
  shareLinkedIn, verifyCertificate, generateDevCertificate,
  getInternshipLogs, getAllInternships, scoreDailyLog,
  assignMentor, attemptExam, updateWBSTask,
  downloadOfferLetter, declineOffer, addDailyLogComment,
} = require('../controllers/ilm.controller');

const { submitDailyLog } = require('../controllers/dailyLog.controller');
const { generateExam, submitQuiz: submitExam } = require('../controllers/finalExam.controller');
const { downloadCertificate } = require('../controllers/examAndCert.controller');

const ADMIN = ['PLATFORM_ADMIN', 'SUPER_ADMIN'];
const ALL_STUDENTS = ['INTERN', 'STUDENT', 'PRO_STUDENT'];
const REVIEWERS = ['MENTOR', ...ADMIN];

// ── Intern: Accept/Decline Offer (MUST be before /offer/:userId to avoid wildcard match) ──
router.post('/offer/accept',            protect, allowRoles(...ALL_STUDENTS), acceptOffer);
router.post('/offer/decline',           protect, allowRoles(...ALL_STUDENTS), declineOffer);

// ── Admin: Send Offer & Manage ────────────────────────────────────────────────
router.post('/offer/:userId',           protect, allowRoles(...ADMIN), sendOffer);

// ── Admin: All Internships ─────────────────────────────────────────────────────
router.get('/all',                      protect, allowRoles(...ADMIN), getAllInternships);

// ── Admin: Assign Mentor ──────────────────────────────────────────────────────
router.patch('/:id/assign-mentor',      protect, allowRoles(...ADMIN), assignMentor);

// ── Admin/Mentor: Score Daily Log ─────────────────────────────────────────────
router.put('/:ilmId/logs/:logId/score', protect, allowRoles(...REVIEWERS), scoreDailyLog);

// ── Intern/Mentor: Add Comment to Daily Log ──────────────────────────────────
router.post('/:ilmId/logs/:logId/comment', protect, addDailyLogComment);

// ── Admin: Get Mentoring Internships ───────────────────────────────────────────
router.get('/mentoring',                protect, allowRoles(...REVIEWERS), getMentoringInternships);

// ── Admin: Submit Monthly Review ──────────────────────────────────────────────
router.put('/mentoring/:ilmId/monthly-review', protect, allowRoles(...REVIEWERS), submitMonthlyReview);

// ── Intern: My Internship ─────────────────────────────────────────────────────
// Allow STUDENT + PRO_STUDENT so Dashboard can check for pending offers without 403
router.get('/my',                       protect, allowRoles(...ALL_STUDENTS), getMyInternship);
router.post('/my/daily-log',            protect, allowRoles(...ALL_STUDENTS), submitDailyLog);
router.patch('/wbs/:weekIndex/:taskIndex', protect, allowRoles(...ALL_STUDENTS), updateWBSTask);

// Daily log route used by DailyLog.jsx (/ilm/daily-log POST)
// Allow STUDENT/PRO_STUDENT too — controller checks for active internship internally
router.post('/daily-log',               protect, allowRoles(...ALL_STUDENTS), submitDailyLog);

// ── Final Exam & Certificate ──────────────────────────────────────────────────
router.get('/exam/generate',            protect, allowRoles('INTERN'), generateExam);
router.post('/exam/submit',             protect, allowRoles('INTERN'), submitExam);
router.post('/exam/attempt',            protect, allowRoles('INTERN'), attemptExam);

router.post('/certificate/share-linkedin', protect, allowRoles('INTERN'), shareLinkedIn);
// DEV OVERRIDE — restrict to INTERN only in production to prevent fake certificates
router.post('/certificate/dev-generate', protect, allowRoles('INTERN'), generateDevCertificate);

// ── Certificate PDF Download (PUBLIC — works directly from email links) ───────
router.get('/certificate/download/:certId', downloadCertificate);

// ── Offer Letter PDF Download (PUBLIC — works directly from email links) ──────
router.get('/offer-letter/download/:internshipId', downloadOfferLetter);

router.get('/verify/:certId', verifyCertificate); // public

module.exports = router;
