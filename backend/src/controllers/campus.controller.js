require('dotenv').config();
const crypto = require('crypto');
const College = require('../models/College');
const CampusDrive = require('../models/CampusDrive');
const DriveApplication = require('../models/DriveApplication');
const Internship = require('../models/Internship');
const User = require('../models/User');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const {
  sendAITestInvite, sendAITestFailed,
  sendCampusInterviewInvite, sendCampusOfferLetter,
} = require('../services/emailService');
const { generateCampusOfferLetterPDF, generateCampusOfferLetterBuffer } = require('../utils/pdfGenerator');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ─── Helpers ────────────────────────────────────────────────────────────────

const calcOverallScore = (app) => {
  const ats  = (app.atsScore   || 0) * 0.40;
  const cgpa = Math.min((app.student.cgpa || 0) / 10, 1) * 100 * 0.30;
  const cl10 = (app.student.class10 || 0) * 0.15;
  const cl12 = (app.student.class12 || 0) * 0.15;
  return Math.round(ats + cgpa + cl10 + cl12);
};

// Helper: get the effective JD for an application (supports multi-JD drives)
const getApplicationJD = (drive, app) => {
  // If drive has jds[] array, use the student's jdIndex
  if (drive.jds && drive.jds.length > 0) {
    const idx = app.jdIndex ?? 0;
    return drive.jds[idx] || drive.jds[0];
  }
  // Fall back to legacy single jd
  return drive.jd || {};
};

// ─── ADMIN: Manage colleges ──────────────────────────────────────────────────

// GET /api/v1/college/admin/list
const adminListColleges = async (req, res) => {
  try {
    const colleges = await College.find().select('-password -refreshToken').sort({ name: 1 });
    res.json({ success: true, colleges });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/v1/college/admin/create
const adminCreateCollege = async (req, res) => {
  try {
    const { name, slug, code, university, email, password, city, address, phone, website, tpo } = req.body;
    const college = await College.create({ name, slug, code, university, email, password, city, address, phone, website, tpo });
    res.status(201).json({ success: true, college: college.toPublicProfile() });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'College with this email/slug/code already exists' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/v1/college/admin/:id
const adminUpdateCollege = async (req, res) => {
  try {
    const college = await College.findByIdAndUpdate(req.params.id, req.body, { new: true }).select('-password -refreshToken');
    if (!college) return res.status(404).json({ success: false, message: 'College not found' });
    res.json({ success: true, college });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/v1/college/admin/:id
const adminDeleteCollege = async (req, res) => {
  try {
    await College.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true, message: 'College deactivated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── ADMIN: Campus Drives ────────────────────────────────────────────────────

// POST /api/v1/college/admin/drives  — create a drive + send JD to college
const adminCreateDrive = async (req, res) => {
  try {
    const {
      collegeId, cohort, title, description, driveDate, venue, mode,
      jd, jds, shortlistingCriteria, enableInterviewRound, mcqConfig,
    } = req.body;

    const college = await College.findById(collegeId);
    if (!college) return res.status(404).json({ success: false, message: 'College not found' });

    // Generate a unique form token
    const applicationFormToken = crypto.randomBytes(24).toString('hex');
    const applicationFormUrl = `${process.env.CLIENT_URL}/apply/${applicationFormToken}`;

    // Build the drive object
    const driveData = {
      college: collegeId,
      cohort: cohort || null,
      createdBy: req.user._id,
      title, description, driveDate, venue, mode,
      shortlistingCriteria,
      applicationFormToken,
      applicationFormUrl,
      status: 'JD_SENT',
      enableInterviewRound: enableInterviewRound === true,
    };

    // Support both single JD and multiple JDs
    if (jds && Array.isArray(jds) && jds.length > 0) {
      driveData.jds = jds;
      // Also set legacy jd to first entry for backward compat
      driveData.jd = jds[0];
    } else if (jd) {
      driveData.jd = jd;
      driveData.jds = [jd]; // wrap single JD into array
    }

    if (mcqConfig) driveData.mcqConfig = mcqConfig;

    const drive = await CampusDrive.create(driveData);

    // Increment college drive count
    await College.findByIdAndUpdate(collegeId, { $inc: { totalDrives: 1 } });

    res.status(201).json({ success: true, drive, applicationFormUrl });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/v1/college/admin/drives — all drives (optionally filter by college)
const adminListDrives = async (req, res) => {
  try {
    const filter = {};
    if (req.query.collegeId) filter.college = req.query.collegeId;
    if (req.query.status) filter.status = req.query.status;

    const drives = await CampusDrive.find(filter)
      .populate('college', 'name code city slug')
      .populate('createdBy', 'profile.firstName profile.lastName')
      .sort({ createdAt: -1 });

    res.json({ success: true, drives });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/v1/college/admin/drives/:id — update drive / open applications
const adminUpdateDrive = async (req, res) => {
  try {
    const drive = await CampusDrive.findByIdAndUpdate(req.params.id, req.body, { new: true })
      .populate('college', 'name code city slug');
    if (!drive) return res.status(404).json({ success: false, message: 'Drive not found' });
    res.json({ success: true, drive });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/v1/college/admin/drives/:id/offer-template — save offer letter template
const adminSaveOfferTemplate = async (req, res) => {
  try {
    const { companyName, signatoryName, signatoryTitle, customTerms, footerText, logoUrl } = req.body;
    const drive = await CampusDrive.findByIdAndUpdate(
      req.params.id,
      { offerLetterTemplate: { companyName, signatoryName, signatoryTitle, customTerms, footerText, logoUrl } },
      { new: true }
    );
    if (!drive) return res.status(404).json({ success: false, message: 'Drive not found' });
    res.json({ success: true, drive, message: 'Offer letter template saved' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/v1/college/admin/drives/:id/applications — list all applications for a drive
const adminListApplications = async (req, res) => {
  try {
    const { status, sortBy = 'overallScore', order = 'desc' } = req.query;
    const filter = { drive: req.params.id };
    if (status) filter.status = status;

    const apps = await DriveApplication.find(filter)
      .sort({ [sortBy]: order === 'asc' ? 1 : -1 });

    res.json({ success: true, applications: apps });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/v1/college/admin/drives/:id/shortlist — bulk shortlist by criteria
const adminShortlistStudents = async (req, res) => {
  try {
    const drive = await CampusDrive.findById(req.params.id);
    if (!drive) return res.status(404).json({ success: false, message: 'Drive not found' });

    const { criteria } = req.body;
    const sc = criteria || drive.shortlistingCriteria;

    const candidates = await DriveApplication.find({
      drive: drive._id,
      status: { $in: ['APPLIED', 'UNDER_REVIEW'] },
      'student.cgpa':    { $gte: sc.minCGPA },
      'student.class10': { $gte: sc.minClass10 },
      'student.class12': { $gte: sc.minClass12 },
      atsScore:          { $gte: sc.minATSScore },
    }).sort({ overallScore: -1 }).limit(sc.slots || 9999);

    const ids = candidates.map(c => c._id);
    await DriveApplication.updateMany({ _id: { $in: ids } }, { status: 'SHORTLISTED', shortlistedAt: new Date() });

    await CampusDrive.findByIdAndUpdate(drive._id, {
      totalShortlisted: ids.length,
      status: 'SHORTLISTED',
    });

    res.json({ success: true, shortlisted: ids.length, message: `${ids.length} students shortlisted` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/v1/college/admin/applications/:appId — update single application status / notes
const adminUpdateApplication = async (req, res) => {
  try {
    const app = await DriveApplication.findByIdAndUpdate(req.params.appId, req.body, { new: true });
    if (!app) return res.status(404).json({ success: false, message: 'Application not found' });
    res.json({ success: true, application: app });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/v1/college/admin/applications/:appId/select — convert selected to intern
const adminSelectStudentAsIntern = async (req, res) => {
  try {
    const app = await DriveApplication.findById(req.params.appId).populate('drive');
    if (!app) return res.status(404).json({ success: false, message: 'Application not found' });

    let platformUser = app.platformUser
      ? await User.findById(app.platformUser)
      : await User.findOne({ email: app.student.email });
    if (platformUser && !app.platformUser) {
      app.platformUser = platformUser._id;
    }

    if (!platformUser) {
      return res.status(400).json({
        success: false,
        message: 'Student has no platform account. Ask them to register first.',
        studentEmail: app.student.email,
      });
    }

    if (platformUser.college && platformUser.college.toString() !== app.college.toString()) {
      return res.status(400).json({ success: false, message: 'Student account is associated with a different college' });
    }

    const { startDate, endDate, stipend, mentor } = req.body;
    const internship = await Internship.create({
      intern: platformUser._id,
      mentor: mentor || null,
      campusDrive: app.drive._id,
      college: app.college,
      cohort: app.cohort || app.drive.cohort || null,
      source: 'CAMPUS_DRIVE',
      startDate,
      endDate,
      stipend: stipend || { amount: 10000, currency: 'INR' },
      status: 'OFFER_SENT',
    });

    app.status = 'OFFER_SENT';
    app.selectedAt = new Date();
    app.internship = internship._id;
    await app.save();

    await User.findByIdAndUpdate(platformUser._id, {
      activeInternship: internship._id,
      role: 'INTERN',
      college: app.college,
      cohort: app.cohort || app.drive.cohort || null,
    });

    await CampusDrive.findByIdAndUpdate(app.drive._id, { $inc: { totalSelected: 1 } });
    await College.findByIdAndUpdate(app.college, { $inc: { totalSelected: 1 } });

    res.json({ success: true, internship, message: 'Internship offer sent' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── PUBLIC: Apply Form ───────────────────────────────────────────────────────

// GET /api/v1/college/apply/:token — get drive info for the form page
const getDriveByToken = async (req, res) => {
  try {
    const drive = await CampusDrive.findOne({ applicationFormToken: req.params.token })
      .populate('college', 'name code city university logo tpo');
    if (!drive || drive.status === 'CANCELLED') {
      return res.status(404).json({ success: false, message: 'Drive not found or cancelled' });
    }
    if (!['APPLICATIONS_OPEN', 'JD_SENT'].includes(drive.status)) {
      return res.status(400).json({ success: false, message: 'Applications are currently closed' });
    }
    res.json({ success: true, drive });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/v1/college/apply/:token — submit application
const submitDriveApplication = async (req, res) => {
  try {
    const drive = await CampusDrive.findOne({ applicationFormToken: req.params.token });
    if (!drive || !['APPLICATIONS_OPEN', 'JD_SENT'].includes(drive.status)) {
      return res.status(400).json({ success: false, message: 'Applications are closed' });
    }

    const { student, jdIndex = 0 } = req.body;

    // Check for duplicate
    const existing = await DriveApplication.findOne({ drive: drive._id, 'student.email': student.email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ success: false, message: 'You have already applied to this drive' });
    }

    // Get the relevant JD for ATS scoring
    const effectiveJD = (drive.jds && drive.jds.length > 0)
      ? (drive.jds[jdIndex] || drive.jds[0])
      : (drive.jd || {});

    // Run ATS scoring via Gemini AI
    let atsScore = null;
    let atsAnalysis = null;
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const prompt = `
You are an ATS (Applicant Tracking System) evaluator for an internship role.

Job Role: ${effectiveJD.role || 'Software Developer Intern'}
Required Skills: ${(effectiveJD.skills || []).join(', ') || 'Programming, Problem Solving'}
Minimum CGPA: ${effectiveJD.minCGPA || 6.0}

Candidate Profile:
- Name: ${student.name}
- Branch: ${student.branch}
- CGPA: ${student.cgpa}
- Skills: ${(student.skills || []).join(', ')}
- Projects: ${student.projects || 'Not mentioned'}
- Resume Text (if available): ${student.resumeText || 'Not provided'}

Score this candidate on a scale of 0-100 for ATS fitment.
Return ONLY a JSON object: {"score": <number 0-100>, "analysis": "<2-3 sentence feedback>"}
`;
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        atsScore = Math.min(100, Math.max(0, parsed.score));
        atsAnalysis = parsed.analysis;
      }
    } catch (_) {
      atsScore = 50;
    }

    const app = await DriveApplication.create({
      drive: drive._id,
      college: drive.college,
      cohort: drive.cohort || null,
      student: { ...student, email: student.email.toLowerCase() },
      jdIndex,
      atsScore,
      atsAnalysis,
    });

    app.overallScore = calcOverallScore(app);
    await app.save();

    await CampusDrive.findByIdAndUpdate(drive._id, { $inc: { totalApplicants: 1 }, status: 'APPLICATIONS_OPEN' });

    res.status(201).json({
      success: true,
      message: 'Application submitted successfully!',
      applicationId: app._id,
      atsScore,
      atsAnalysis,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'You have already applied to this drive' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── COLLEGE PORTAL: Auth & Drive Views ──────────────────────────────────────

const collegeGetProfile = async (req, res) => {
  try {
    res.json({ success: true, college: req.college.toPublicProfile() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const collegeGetDrives = async (req, res) => {
  try {
    const drives = await CampusDrive.find({ college: req.college._id }).sort({ createdAt: -1 });
    res.json({ success: true, drives });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const collegeGetDriveApplications = async (req, res) => {
  try {
    const drive = await CampusDrive.findOne({ _id: req.params.id, college: req.college._id });
    if (!drive) return res.status(404).json({ success: false, message: 'Drive not found' });

    const apps = await DriveApplication.find({ drive: drive._id })
      .sort({ overallScore: -1 });

    res.json({ success: true, applications: apps, drive });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const collegeGetShortlisted = async (req, res) => {
  try {
    const drive = await CampusDrive.findOne({ _id: req.params.id, college: req.college._id });
    if (!drive) return res.status(404).json({ success: false, message: 'Drive not found' });

    const apps = await DriveApplication.find({ drive: drive._id, status: { $in: ['SHORTLISTED', 'ROUND_2', 'ROUND_3', 'SELECTED', 'OFFER_SENT'] } })
      .sort({ overallScore: -1 });

    res.json({ success: true, shortlisted: apps, drive });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/v1/college/portal/internships — college-scoped ILM monitoring
const collegeGetInternships = async (req, res) => {
  try {
    const filter = { college: req.college._id };
    if (req.query.cohort) filter.cohort = req.query.cohort;
    if (req.query.status) filter.status = req.query.status;

    const internships = await Internship.find(filter)
      .populate('intern', 'profile email role cohort')
      .populate('mentor', 'profile email role')
      .populate('company', 'name logo')
      .populate('campusDrive', 'title cohort')
      .sort({ createdAt: -1 });

    res.json({ success: true, internships });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getCollegePublicInfo = async (req, res) => {
  try {
    const college = await College.findOne({ slug: req.params.slug, isActive: true }).select('-password -refreshToken -email');
    if (!college) return res.status(404).json({ success: false, message: 'College not found' });
    res.json({ success: true, college });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


// ─── AI Test Pipeline ─────────────────────────────────────────────────────────

// POST /api/v1/college/admin/drives/:id/generate-questions
// Admin previews AI-generated questions for a drive (before sending to any student)
const adminGenerateDriveQuestions = async (req, res) => {
  try {
    const drive = await CampusDrive.findById(req.params.id);
    if (!drive) return res.status(404).json({ success: false, message: 'Drive not found' });

    const { jdIndex = 0 } = req.body;
    const effectiveJD = (drive.jds && drive.jds.length > 0)
      ? (drive.jds[jdIndex] || drive.jds[0])
      : (drive.jd || {});

    const role = effectiveJD.role || 'Software Developer Intern';
    const skills = (effectiveJD.skills || []).join(', ') || 'Programming';
    const questionCount = drive.mcqConfig?.questionCount || 10;

    let questions = [];
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = `Generate exactly ${questionCount} multiple-choice questions to test a candidate for the role: "${role}".
Skills to test: ${skills}.
Each question must have 4 options (A, B, C, D) and one correct answer.
Vary difficulty: mix easy, medium, and hard questions.
Return ONLY a valid JSON array like:
[{"q":"Question text?","options":["A. opt1","B. opt2","C. opt3","D. opt4"],"correct":"A"}]
No markdown, no extra text.`;
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim().replace(/```json|```/g, '');
    const match = text.match(/\[[\s\S]*\]/);
    if (match) questions = JSON.parse(match[0]).slice(0, questionCount);

    res.json({ success: true, questions, role, skills, jdIndex });
  } catch (err) {
    console.error('[Generate Drive Questions]', err.message);
    res.status(500).json({ success: false, message: 'Failed to generate questions. Try again.' });
  }
};

// POST /api/v1/college/admin/applications/:appId/generate-test
// Admin generates (and stores) AI questions for a specific application for review
const adminGenerateAIQuestionsForApp = async (req, res) => {
  try {
    const app = await DriveApplication.findById(req.params.appId).populate('drive');
    if (!app) return res.status(404).json({ success: false, message: 'Application not found' });
    if (app.status !== 'SHORTLISTED') return res.status(400).json({ success: false, message: 'Student must be shortlisted first' });

    const drive = app.drive;
    const effectiveJD = getApplicationJD(drive, app);
    const role = effectiveJD.role || 'Software Developer Intern';
    const skills = (effectiveJD.skills || []).join(', ') || 'Programming';
    const questionCount = drive.mcqConfig?.questionCount || 10;

    let questions = [];
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = `Generate exactly ${questionCount} multiple-choice questions to test a candidate for the role: "${role}".
Skills to test: ${skills}.
Each question must have 4 options (A, B, C, D) and one correct answer.
Vary difficulty: mix easy, medium, and hard questions.
Return ONLY a valid JSON array like:
[{"q":"Question text?","options":["A. opt1","B. opt2","C. opt3","D. opt4"],"correct":"A"}]
No markdown, no extra text.`;
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim().replace(/```json|```/g, '');
    const match = text.match(/\[[\s\S]*\]/);
    if (match) questions = JSON.parse(match[0]).slice(0, questionCount);

    // Store questions on application for review (not sent yet)
    app.aiTest = { ...app.aiTest, questions, questionsReviewed: false };
    await app.save();

    res.json({ success: true, questions, role, skills });
  } catch (e) {
    console.error('[AI Test Gen]', e.message);
    res.status(500).json({ success: false, message: 'Failed to generate questions. Try again.' });
  }
};

// PUT /api/v1/college/admin/applications/:appId/update-test-questions
// Admin edits the generated questions and saves them
const adminUpdateAITestQuestions = async (req, res) => {
  try {
    const { questions } = req.body;
    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ success: false, message: 'Questions array is required' });
    }

    const app = await DriveApplication.findById(req.params.appId);
    if (!app) return res.status(404).json({ success: false, message: 'Application not found' });

    app.aiTest = { ...app.aiTest, questions, questionsReviewed: true };
    await app.save();

    res.json({ success: true, message: 'Questions saved successfully', questions });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/v1/college/admin/applications/:appId/send-ai-test
// Sends the (possibly edited) AI test to the student
const adminSendAITest = async (req, res) => {
  try {
    const app = await DriveApplication.findById(req.params.appId).populate('drive');
    if (!app) return res.status(404).json({ success: false, message: 'Application not found' });
    if (app.status !== 'SHORTLISTED') return res.status(400).json({ success: false, message: 'Student must be shortlisted first' });

    const drive = app.drive;
    const effectiveJD = getApplicationJD(drive, app);
    const role = effectiveJD.role || 'Software Developer Intern';
    const skills = (effectiveJD.skills || []).join(', ') || 'Programming';
    const questionCount = drive.mcqConfig?.questionCount || 10;

    // Use existing reviewed questions if available, otherwise generate fresh
    let questions = app.aiTest?.questions;
    if (!questions || questions.length === 0) {
      try {
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const prompt = `Generate exactly ${questionCount} multiple-choice questions to test a candidate for the role: "${role}".
Skills to test: ${skills}.
Each question must have 4 options (A, B, C, D) and one correct answer.
Return ONLY a valid JSON array like:
[{"q":"Question text?","options":["A. opt1","B. opt2","C. opt3","D. opt4"],"correct":"A"}]
No markdown, no extra text.`;
        const result = await model.generateContent(prompt);
        const text = result.response.text().trim().replace(/```json|```/g, '');
        const match = text.match(/\[[\s\S]*\]/);
        if (match) questions = JSON.parse(match[0]).slice(0, questionCount);
      } catch (e) {
        console.error('[AI Test Gen]', e.message);
        return res.status(500).json({ success: false, message: 'Failed to generate questions. Try again.' });
      }
    }

    const token = crypto.randomBytes(32).toString('hex');
    const testUrl = `${process.env.CLIENT_URL}/ai-test/${token}`;

    app.aiTest = { token, sentAt: new Date(), questions, questionsReviewed: app.aiTest?.questionsReviewed || false };
    app.status = 'AI_TEST_SENT';
    await app.save();

    try {
      await sendAITestInvite(
        app.student.email, app.student.name,
        role, testUrl, drive?.title || 'Campus Drive'
      );
    } catch (emailErr) {
      console.warn('[AI Test Email]', emailErr.message);
    }

    res.json({ success: true, message: `AI test sent to ${app.student.email}`, testUrl });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/v1/college/test/:token  — student fetches their test
const getAITest = async (req, res) => {
  try {
    const app = await DriveApplication.findOne({ 'aiTest.token': req.params.token }).populate('drive', 'title jd jds mcqConfig');
    if (!app || !app.aiTest?.questions) return res.status(404).json({ success: false, message: 'Test not found or expired' });
    if (app.aiTest.submittedAt) return res.status(400).json({ success: false, message: 'Test already submitted' });

    const drive = app.drive;
    const effectiveJD = getApplicationJD(drive, app);

    // Return questions WITHOUT correct answers
    const safeQuestions = app.aiTest.questions.map(({ q, options }) => ({ q, options }));
    res.json({
      success: true,
      studentName: app.student.name,
      role: effectiveJD.role || 'Intern',
      driveTitle: drive?.title,
      questions: safeQuestions,
      totalQuestions: safeQuestions.length,
      timeLimit: drive?.mcqConfig?.timeLimit || 20,
      passingScore: drive?.mcqConfig?.passingScore || 60,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/v1/college/test/:token/submit  — student submits answers
const submitAITest = async (req, res) => {
  try {
    const app = await DriveApplication.findOne({ 'aiTest.token': req.params.token }).populate('drive', 'title jd jds mcqConfig');
    if (!app || !app.aiTest?.questions) return res.status(404).json({ success: false, message: 'Test not found' });
    if (app.aiTest.submittedAt) return res.status(400).json({ success: false, message: 'Test already submitted' });

    const { answers } = req.body;
    const questions = app.aiTest.questions;
    const passingScore = app.drive?.mcqConfig?.passingScore || 60;

    let correct = 0;
    questions.forEach((q, i) => {
      const studentAns = (answers[i] || '').trim().charAt(0).toUpperCase();
      const correctAns = (q.correct || '').trim().charAt(0).toUpperCase();
      if (studentAns === correctAns) correct++;
    });

    const score = Math.round((correct / questions.length) * 100);
    const passed = score >= passingScore;

    app.aiTest.answers = answers;
    app.aiTest.score = score;
    app.aiTest.passed = passed;
    app.aiTest.submittedAt = new Date();
    app.aiTest.token = undefined;
    app.status = passed ? 'AI_TEST_PASSED' : 'AI_TEST_FAILED';
    await app.save();

    const effectiveJD = getApplicationJD(app.drive, app);
    const role = effectiveJD.role || 'Intern';
    const driveTitle = app.drive?.title || 'Campus Drive';

    if (!passed) {
      try {
        await sendAITestFailed(app.student.email, app.student.name, role, score, driveTitle);
      } catch (_) {}
    }

    res.json({
      success: true,
      score,
      passed,
      correct,
      total: questions.length,
      passingScore,
      message: passed
        ? `🎉 Congratulations! You scored ${score}% and passed the assessment.`
        : `You scored ${score}%. The minimum passing score is ${passingScore}%. Better luck next time!`,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/v1/college/admin/applications/:appId/schedule-interview
const adminScheduleInterview = async (req, res) => {
  try {
    const { meetLink, scheduledAt, notes } = req.body;
    if (!meetLink) return res.status(400).json({ success: false, message: 'Meet link is required' });

    const app = await DriveApplication.findById(req.params.appId).populate('drive', 'title jd jds enableInterviewRound');
    if (!app) return res.status(404).json({ success: false, message: 'Application not found' });
    if (app.status !== 'AI_TEST_PASSED') return res.status(400).json({ success: false, message: 'Student must have passed the AI test first' });

    app.interview = { scheduled: true, meetLink, scheduledAt, notes, outcome: 'PENDING' };
    app.status = 'INTERVIEW_SCHEDULED';
    await app.save();

    const effectiveJD = getApplicationJD(app.drive, app);
    const role = effectiveJD.role || 'Intern';
    const driveTitle = app.drive?.title || 'Campus Drive';

    try {
      await sendCampusInterviewInvite(app.student.email, app.student.name, role, meetLink, scheduledAt, driveTitle);
    } catch (emailErr) {
      console.warn('[Interview Email]', emailErr.message);
    }

    res.json({ success: true, message: `Interview scheduled and email sent to ${app.student.email}` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/v1/college/admin/applications/:appId/send-offer
const adminSendCampusOffer = async (req, res) => {
  try {
    const { startDate, endDate, stipend } = req.body;
    const app = await DriveApplication.findById(req.params.appId).populate('drive college');
    if (!app) return res.status(404).json({ success: false, message: 'Application not found' });

    // Allow sending offer after AI test passed, interview done, or selected
    const validStatuses = ['AI_TEST_PASSED', 'INTERVIEW_SCHEDULED', 'INTERVIEW_DONE', 'SELECTED'];
    if (!validStatuses.includes(app.status)) {
      return res.status(400).json({ success: false, message: `Cannot send offer in status: ${app.status}` });
    }

    const drive = app.drive;
    const effectiveJD = getApplicationJD(drive, app);
    const role = effectiveJD.role || 'Intern';
    const collegeName = app.college?.name || '';
    const driveTitle = drive?.title || 'Campus Drive';
    const stipendAmount = stipend?.amount || stipend || effectiveJD.stipend || 10000;

    const acceptToken = crypto.randomBytes(32).toString('hex');
    const rejectToken = crypto.randomBytes(32).toString('hex');
    const acceptUrl = `${process.env.API_URL}/api/v1/college/offer/accept?token=${acceptToken}`;
    const rejectUrl = `${process.env.API_URL}/api/v1/college/offer/reject?token=${rejectToken}`;

    // Generate PDF buffer for email attachment
    let pdfBuffer = null;
    try {
      pdfBuffer = await generateCampusOfferLetterBuffer({
        studentName: app.student.name,
        role, collegeName,
        startDate, endDate,
        stipend: stipendAmount,
        template: drive.offerLetterTemplate,
      });
    } catch (pdfErr) {
      console.warn('[Offer PDF Buffer]', pdfErr.message);
    }

    app.status = 'OFFER_SENT';
    app.selectedAt = new Date();
    app.offerLetter = { sentAt: new Date(), acceptToken, rejectToken };
    await app.save();

    // Send email with PDF attachment
    try {
      await sendCampusOfferLetter(
        app.student.email, app.student.name,
        role, collegeName,
        startDate, endDate, stipendAmount,
        acceptUrl, rejectUrl, driveTitle,
        pdfBuffer  // ← PDF buffer as attachment
      );
    } catch (emailErr) {
      console.warn('[Offer Email]', emailErr.message);
    }

    await CampusDrive.findByIdAndUpdate(drive._id, { $inc: { totalSelected: 1 } });
    await College.findByIdAndUpdate(app.college._id, { $inc: { totalSelected: 1 } });

    res.json({
      success: true,
      message: `Offer letter sent to ${app.student.email} with PDF attachment`,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/v1/college/offer/accept?token=xxx
const acceptCampusOffer = async (req, res) => {
  try {
    const app = await DriveApplication.findOne({ 'offerLetter.acceptToken': req.query.token });
    if (!app) return res.status(400).send('<h2 style="font-family:sans-serif;color:#f87171">Invalid or expired link.</h2>');

    app.status = 'SELECTED';
    app.offerLetter.accepted = true;
    app.offerLetter.respondedAt = new Date();
    app.offerLetter.acceptToken = undefined;
    app.offerLetter.rejectToken = undefined;
    await app.save();

    res.send(`<html><body style="font-family:sans-serif;background:#0f1623;color:#e8edf8;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0"><div style="text-align:center;padding:40px"><h1 style="color:#34d399;font-size:2rem">🎉 Offer Accepted!</h1><p>Welcome aboard! You have officially accepted the internship offer. Log in to HireStorm to begin your journey.</p><a href="${process.env.CLIENT_URL}/dashboard" style="display:inline-block;margin-top:20px;padding:12px 28px;background:#4f46e5;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold">Go to Dashboard →</a></div></body></html>`);
  } catch (err) {
    res.status(500).send('<h2>Server error. Please contact support.</h2>');
  }
};

// GET /api/v1/college/offer/reject?token=xxx
const rejectCampusOffer = async (req, res) => {
  try {
    const app = await DriveApplication.findOne({ 'offerLetter.rejectToken': req.query.token });
    if (!app) return res.status(400).send('<h2 style="font-family:sans-serif;color:#f87171">Invalid or expired link.</h2>');

    app.status = 'REJECTED';
    app.offerLetter.accepted = false;
    app.offerLetter.respondedAt = new Date();
    app.offerLetter.acceptToken = undefined;
    app.offerLetter.rejectToken = undefined;
    await app.save();

    res.send(`<html><body style="font-family:sans-serif;background:#0f1623;color:#e8edf8;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0"><div style="text-align:center;padding:40px"><h1 style="color:#f87171">Offer Declined</h1><p>We respect your decision. Good luck with your future endeavors!</p><a href="${process.env.CLIENT_URL}" style="display:inline-block;margin-top:20px;padding:12px 28px;background:#4f46e5;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold">Back to Home</a></div></body></html>`);
  } catch (err) {
    res.status(500).send('<h2>Server error.</h2>');
  }
};

module.exports = {
  // Admin — colleges
  adminListColleges, adminCreateCollege, adminUpdateCollege, adminDeleteCollege,
  // Admin — drives
  adminCreateDrive, adminListDrives, adminUpdateDrive,
  adminListApplications, adminShortlistStudents,
  adminUpdateApplication, adminSelectStudentAsIntern,
  adminSaveOfferTemplate,
  // Admin — AI Test pipeline
  adminGenerateDriveQuestions,
  adminGenerateAIQuestionsForApp,
  adminUpdateAITestQuestions,
  adminSendAITest,
  adminScheduleInterview,
  adminSendCampusOffer,
  // Public test
  getAITest, submitAITest,
  // Offer accept/reject
  acceptCampusOffer, rejectCampusOffer,
  // Public form
  getDriveByToken, submitDriveApplication,
  // College portal
  collegeGetProfile, collegeGetDrives, collegeGetDriveApplications, collegeGetShortlisted, collegeGetInternships,
  // Public
  getCollegePublicInfo,
};
