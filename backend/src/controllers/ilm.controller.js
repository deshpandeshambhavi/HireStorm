const Internship = require('../models/Internship');
const User = require('../models/User');
const { generateWBS } = require('../services/wbsGenerator');
const { generateCertificate } = require('../services/certificateService');
const { shareCertificateOnLinkedIn } = require('../services/linkedinService');
const { sendOfferLetter, sendCertificateEmail } = require('../services/emailService');
const { notify } = require('../services/notificationService');
const { generateOfferLetterPDF } = require('../services/letterGenerator');

// POST /api/v1/ilm/offer/:userId — admin sends offer
exports.sendOffer = async (req, res) => {
  try {
    const { mentorId, hackathonId, companyId, collegeId, cohort, startDate, stipendAmount, domain, durationDays = 90 } = req.body;
    const intern = await User.findById(req.params.userId).select('+college');
    if (!intern) return res.status(404).json({ success: false, message: 'User not found' });
    const college = collegeId || intern.college || null;
    if (collegeId && intern.college && intern.college.toString() !== collegeId.toString()) {
      return res.status(400).json({ success: false, message: 'Intern is associated with a different college' });
    }
    if (mentorId) {
      const mentor = await User.findById(mentorId);
      if (!mentor || !['MENTOR', 'PLATFORM_ADMIN', 'SUPER_ADMIN'].includes(mentor.role)) {
        return res.status(400).json({ success: false, message: 'Selected user is not an eligible mentor' });
      }
      if (college && mentor.college && mentor.college.toString() !== college.toString()) {
        return res.status(400).json({ success: false, message: 'Mentor belongs to a different college' });
      }
    }

    const start = new Date(startDate || Date.now());
    const duration = Number(durationDays);
    const end   = new Date(start.getTime() + duration * 24 * 60 * 60 * 1000);

    // Generate WBS — stored under 'wbs' field (not wbsTasks)
    const wbs = generateWBS(start, intern.profile?.skills || [], domain, duration);

    // Generate official Erfinden / InnoByes branded offer letter PDF (validate only)
    // The actual PDF is served on-the-fly via the download endpoint below.
    let offerLetterUrl = null;
    try {
      await generateOfferLetterPDF({
        firstName:  intern.profile?.firstName || 'Intern',
        lastName:   intern.profile?.lastName  || '',
        startDate:  start,
        endDate:    end,
        role:       domain || 'Developer – Intern',
        stipend:    stipendAmount || 0,
      });
      // URL will be set once internship document is created (uses internship._id)
    } catch (pdfErr) {
      console.error('[sendOffer] PDF validation error:', pdfErr.message);
    }

    const internship = await Internship.create({
      intern:    req.params.userId,
      mentor:    mentorId || null,
      hackathon: hackathonId || null,
      company:   companyId  || null,
      college,
      cohort:    cohort || intern.cohort || null,
      startDate: start,
      endDate:   end,
      durationDays: duration,
      status:    'OFFER_SENT',
      offerStatus: 'PENDING',
      stipend:   { amount: stipendAmount ?? 10000 },
      offerLetterUrl,
      wbs,          // ← correct field name
    });

    // Build backend download URL using the new internship ID
    const apiBase = process.env.API_URL || 'http://localhost:5000';
    offerLetterUrl = `${apiBase}/api/v1/ilm/offer-letter/download/${internship._id}`;
    internship.offerLetterUrl = offerLetterUrl;
    await internship.save();

    if (offerLetterUrl) {
      try { await sendOfferLetter(intern.email, intern.profile.firstName, offerLetterUrl); } catch {}
    }
    await notify({
      recipientId: intern._id,
      type:    'OFFER_LETTER',
      title:   'Internship Offer Received',
      message: 'Please review and accept your internship offer on the platform.',
      link:    '/dashboard',
      channel: ['IN_APP'],
    });

    res.status(201).json({ success: true, data: internship });
  } catch (err) {
    console.error('[sendOffer]', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/v1/ilm/offer/accept
exports.acceptOffer = async (req, res) => {
  try {
    const internship = await Internship.findOne({ intern: req.user._id, offerStatus: 'PENDING' });
    if (!internship) return res.status(404).json({ success: false, message: 'No pending offer found' });
    internship.offerStatus     = 'ACCEPTED';
    internship.offerAcceptedAt = new Date();
    internship.status          = 'ACTIVE';
    internship.startDate       = internship.startDate || new Date();
    const duration = internship.durationDays || 90;
    internship.endDate         = internship.endDate   || new Date(Date.now() + duration * 24 * 60 * 60 * 1000);
    await internship.save();
    await User.findByIdAndUpdate(req.user._id, { role: 'INTERN', activeInternship: internship._id });
    res.json({ success: true, data: internship });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/v1/ilm/offer/decline
exports.declineOffer = async (req, res) => {
  try {
    const internship = await Internship.findOne({ intern: req.user._id, offerStatus: 'PENDING' });
    if (!internship) return res.status(404).json({ success: false, message: 'No pending offer found' });
    
    internship.offerStatus = 'REJECTED';
    internship.status      = 'REJECTED';
    await internship.save();
    
    res.json({ success: true, data: internship });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/v1/ilm/my
exports.getMyInternship = async (req, res) => {
  try {
    const internship = await Internship.findOne({ intern: req.user._id })
      .populate('college', 'name code slug')
      .populate('mentor',   'profile email')
      .populate('company',  'name logo')
      .populate('hackathon','title slug');
    // Return null (not 404) so students with no internship don't trigger axios errors
    if (!internship) return res.json({ success: true, data: null });
    res.json({ success: true, data: internship });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/v1/ilm/all — admin sees all interns
exports.getAllInternships = async (req, res) => {
  try {
    const filter = {};
    if (req.query.collegeId) filter.college = req.query.collegeId;
    if (req.query.cohort) filter.cohort = req.query.cohort;
    const internships = await Internship.find(filter)
      .populate('intern',   'profile email')
      .populate('company',  'name')
      .populate('mentor',   'profile email')
      .populate('college',  'name code slug')
      .populate('hackathon','title slug')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: internships });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/v1/ilm/:id/assign-mentor — admin assigns a mentor
exports.assignMentor = async (req, res) => {
  try {
    const { mentorId } = req.body;
    if (!mentorId) return res.status(400).json({ success: false, message: 'mentorId is required' });

    const mentor = await User.findById(mentorId);
    if (!mentor || !['MENTOR', 'PLATFORM_ADMIN', 'SUPER_ADMIN'].includes(mentor.role)) {
      return res.status(404).json({ success: false, message: 'Eligible mentor not found' });
    }

    const existing = await Internship.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Internship not found' });
    if (existing.college && mentor.college && existing.college.toString() !== mentor.college.toString()) {
      return res.status(400).json({ success: false, message: 'Mentor belongs to a different college' });
    }

    const internship = await Internship.findByIdAndUpdate(
      req.params.id,
      { mentor: mentorId },
      { new: true }
    ).populate('intern', 'profile email').populate('mentor', 'profile email');

    await notify({
      recipientId: internship.intern._id,
      type:    'GENERAL',
      title:   'Mentor Assigned',
      message: `${mentor.profile?.firstName} ${mentor.profile?.lastName} has been assigned as your mentor.`,
      link:    '/ilm',
      channel: ['IN_APP'],
    });

    res.json({ success: true, data: internship });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/v1/ilm/:ilmId/logs/:logId/score
exports.scoreDailyLog = async (req, res) => {
  try {
    const { score, feedback } = req.body;
    if (score === undefined || score < 0 || score > 10) {
      return res.status(400).json({ success: false, message: 'Score must be 0–10' });
    }
    const internship = await Internship.findById(req.params.ilmId);
    if (!internship) return res.status(404).json({ success: false, message: 'Not found' });
    const canReview = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'MENTOR'].includes(req.user.role)
      && (['PLATFORM_ADMIN', 'SUPER_ADMIN'].includes(req.user.role) || internship.mentor?.toString() === req.user._id.toString());
    if (!canReview) return res.status(403).json({ success: false, message: 'Not authorized to review this internship' });

    const log = internship.dailyLogs.id(req.params.logId);
    if (!log) return res.status(404).json({ success: false, message: 'Log not found' });

    log.mentorScore = Number(score);
    log.status      = 'REVIEWED';

    if (feedback && feedback.trim()) {
      log.comments.push({
        role: 'MENTOR',
        message: feedback.trim()
      });
    }

    await internship.save();

    res.json({ success: true, data: internship });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/v1/ilm/:ilmId/logs/:logId/comment
exports.addDailyLogComment = async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }
    const internship = await Internship.findById(req.params.ilmId);
    if (!internship) return res.status(404).json({ success: false, message: 'Not found' });

    const log = internship.dailyLogs.id(req.params.logId);
    if (!log) return res.status(404).json({ success: false, message: 'Log not found' });

    const isIntern = req.user.role === 'INTERN' || req.user.role === 'STUDENT' || req.user.role === 'PRO_STUDENT';
    const isReviewer = ['MENTOR', 'PLATFORM_ADMIN', 'SUPER_ADMIN'].includes(req.user.role)
      && (['PLATFORM_ADMIN', 'SUPER_ADMIN'].includes(req.user.role) || internship.mentor?.toString() === req.user._id.toString());
    if (!isIntern && !isReviewer) return res.status(403).json({ success: false, message: 'Not authorized to comment on this internship' });
    const role = isIntern
      ? 'INTERN' 
      : 'MENTOR';

    log.comments.push({
      role,
      message: message.trim()
    });

    await internship.save();

    res.json({ success: true, data: internship });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/v1/ilm/mentoring — mentor sees their interns
exports.getMentoringInternships = async (req, res) => {
  try {
    const internships = await Internship.find({ mentor: req.user._id })
      .populate('intern', 'profile email')
      .populate('company', 'name')
      .populate('college', 'name code slug');
    res.json({ success: true, data: internships });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/v1/ilm/mentoring/:ilmId/monthly-review
// Allowed: MENTOR (must own the intern) or PLATFORM_ADMIN / SUPER_ADMIN (bypass)
exports.submitMonthlyReview = async (req, res) => {
  try {
    const { month, taskCompletion, codeQuality, communication, initiative, feedback } = req.body;
    const internship = await Internship.findById(req.params.ilmId);
    if (!internship) return res.status(404).json({ success: false, message: 'Not found' });

    const isAdmin = ['PLATFORM_ADMIN', 'SUPER_ADMIN'].includes(req.user.role);
    if (!isAdmin && internship.mentor?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not your intern' });
    }

    const tC = Number(taskCompletion) || 0;
    const cQ = Number(codeQuality)    || 0;
    const cm = Number(communication)  || 0;
    const in_ = Number(initiative)    || 0;
    const totalScore = tC + cQ + cm + in_;

    const reviewObj = {
      month,
      reviewDate: new Date(),
      rubric: { taskCompletion: tC, codeQuality: cQ, communication: cm, initiative: in_ },
      totalScore,
      feedback: feedback || '',
      status: 'COMPLETED',
      reviewedBy: req.user._id,
    };

    const reviewIdx = internship.monthlyReviews.findIndex(r => r.month === month);
    if (reviewIdx >= 0) internship.monthlyReviews[reviewIdx] = reviewObj;
    else internship.monthlyReviews.push(reviewObj);

    // Recalculate CA score
    const completed = internship.monthlyReviews.filter(r => r.status === 'COMPLETED');
    if (completed.length > 0) {
      internship.continuousAssessmentScore =
        completed.reduce((sum, r) => sum + r.totalScore, 0) / completed.length;
    }

    // Unlock exam after last month
    const requiredMonths = (internship.durationDays || 90) / 30;
    if (month === requiredMonths) {
      if (internship.continuousAssessmentScore >= internship.assessmentThreshold) {
        internship.isExamUnlocked = true;
        await notify({
          recipientId: internship.intern,
          type:    'CERTIFICATE_READY',
          title:   '🎓 Final Exam Unlocked!',
          message: 'You have passed your continuous assessment. The final exam is now available.',
          link:    '/ilm/exam',
          channel: ['IN_APP'],
        });
      } else {
        internship.status = 'FAILED_ASSESSMENT';
      }
    }

    await internship.save();
    res.json({ success: true, data: internship });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/v1/ilm/wbs/:weekIndex/:taskIndex — mark a WBS task as DONE or PENDING
exports.updateWBSTask = async (req, res) => {
  try {
    const { weekIndex, taskIndex } = req.params;
    const { status } = req.body; // 'DONE' or 'PENDING'
    if (!['DONE', 'PENDING'].includes(status)) {
      return res.status(400).json({ success: false, message: 'status must be DONE or PENDING' });
    }
    const internship = await Internship.findOne({ intern: req.user._id, status: 'ACTIVE' });
    if (!internship) return res.status(404).json({ success: false, message: 'No active internship' });

    const wk = internship.wbs[Number(weekIndex)];
    if (!wk) return res.status(404).json({ success: false, message: 'Week not found' });
    const task = wk.tasks[Number(taskIndex)];
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

    task.status = status;
    internship.markModified('wbs');
    await internship.save();
    res.json({ success: true, data: internship.wbs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/v1/ilm/internship-logs (unused, kept for compat)
exports.getInternshipLogs = async (req, res) => {
  try {
    const internship = await Internship.findOne({ intern: req.user._id });
    if (!internship) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: internship.dailyLogs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/v1/ilm/certificate/share-linkedin
exports.shareLinkedIn = async (req, res) => {
  try {
    const internship = await Internship.findOne({ intern: req.user._id });
    if (!internship?.certificate?.isGenerated) {
      return res.status(400).json({ success: false, message: 'No certificate available' });
    }
    const result = await shareCertificateOnLinkedIn(internship._id);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/v1/ilm/certificate/dev-generate — FOR TESTING PURPOSES ONLY
exports.generateDevCertificate = async (req, res) => {
  try {
    const internship = await Internship.findOne({ intern: req.user._id });
    if (!internship) return res.status(404).json({ success: false, message: 'No internship found' });
    
    // Force pass the exam
    internship.exam = { attemptedAt: new Date(), score: 100, isPassed: true };
    internship.isExamUnlocked = true;
    await internship.save();
    
    const { certificateId, certificateUrl } = await generateCertificate(internship._id);
    
    // Notify
    const intern = await User.findById(internship.intern);
    await sendCertificateEmail(intern.email, `${intern.profile?.firstName} ${intern.profile?.lastName}`, certificateUrl, internship.durationDays || 90).catch(() => {});
    await notify({ recipientId: internship.intern, type: 'CERTIFICATE_READY', title: '🏆 Certificate Ready!', message: 'Congratulations! Your certificate has been generated.', link: '/ilm/certificate', channel: ['IN_APP'] });
    
    res.json({ success: true, data: { certificateId, certificateUrl } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/v1/ilm/verify/:certId — public certificate verification
exports.verifyCertificate = async (req, res) => {
  try {
    const internship = await Internship.findOne({ 'certificate.certificateId': req.params.certId })
      .populate('intern',  'profile.firstName profile.lastName')
      .populate('company', 'name');
    if (!internship) return res.status(404).json({ success: false, message: 'Certificate not found' });
    res.json({
      success: true,
      data: {
        certificateId: req.params.certId,
        intern:        internship.intern?.profile,
        company:       internship.company?.name || 'HireStorm',
        issuedAt:      internship.certificate.issuedAt,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/v1/ilm/exam/attempt (legacy)
exports.attemptExam = async (req, res) => {
  try {
    const { score } = req.body;
    const internship = await Internship.findOne({ intern: req.user._id, isExamUnlocked: true });
    if (!internship) return res.status(403).json({ success: false, message: 'Exam not unlocked' });
    if (internship.exam?.attemptedAt) return res.status(400).json({ success: false, message: 'Already attempted' });

    const isPassed = score >= (internship.exam?.passMark || 70);
    internship.exam = { attemptedAt: new Date(), score, isPassed };
    await internship.save();

    if (isPassed) {
      try {
        const { certificateId, certificateUrl } = await generateCertificate(internship._id);
        const intern = await User.findById(internship.intern);
        if (intern.email) {
          await sendCertificateEmail(intern.email, `${intern.profile?.firstName} ${intern.profile?.lastName}`, certificateUrl, internship.durationDays || 90);
        }
        await notify({ recipientId: internship.intern, type: 'CERTIFICATE_READY', title: '🏆 Certificate Ready!', message: 'Congratulations! Your certificate has been generated.', link: '/ilm/certificate', channel: ['IN_APP'] });
      } catch (certErr) {
        console.error('[attemptExam] Certificate gen error:', certErr.message);
      }
    }
    res.json({ success: true, data: { isPassed, score } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/v1/ilm/offer-letter/download/:internshipId  (public — works from email links)
// Streams the branded offer letter PDF on-the-fly without any Cloudinary dependency.
exports.downloadOfferLetter = async (req, res) => {
  try {
    const internship = await Internship.findById(req.params.internshipId)
      .populate('intern', 'profile email');

    if (!internship) {
      return res.status(404).json({ success: false, message: 'Internship not found' });
    }

    const intern = internship.intern;
    const firstName = intern.profile?.firstName || 'Intern';
    const lastName  = intern.profile?.lastName  || '';

    const pdfBuffer = await generateOfferLetterPDF({
      firstName,
      lastName,
      startDate: internship.startDate,
      endDate:   internship.endDate,
      role:      internship.role || 'Developer – Intern',
      stipend:   internship.stipend?.amount || 0,
    });

    const safeFileName = `OfferLetter_${firstName}_${lastName}_${internship._id}.pdf`.replace(/\s+/g, '_');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${safeFileName}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Cache-Control', 'no-store');
    return res.end(pdfBuffer);

  } catch (err) {
    console.error('[downloadOfferLetter]', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

