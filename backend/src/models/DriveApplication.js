const mongoose = require('mongoose');

// Submitted by students via public form link
const driveApplicationSchema = new mongoose.Schema({
  drive:    { type: mongoose.Schema.Types.ObjectId, ref: 'CampusDrive', required: true },
  college:  { type: mongoose.Schema.Types.ObjectId, ref: 'College', required: true },
  cohort:   { type: String, trim: true, default: null },

  // Which JD index the student applied for (0-based, maps to drive.jds[jdIndex])
  jdIndex: { type: Number, default: 0 },

  // Student personal info (collected in form, may link to User later)
  student: {
    name:       { type: String, required: true },
    email:      { type: String, required: true, lowercase: true },
    phone:      { type: String },
    rollNo:     { type: String },
    branch:     { type: String },
    year:       { type: String },
    cgpa:       { type: Number },
    class10:    { type: Number },
    class12:    { type: Number },
    linkedIn:   { type: String },
    portfolio:  { type: String },
    resumeUrl:  { type: String },
    skills:     [String],
    projects:   { type: String },
  },

  // ATS Score (computed by AI)
  atsScore:       { type: Number, default: null },
  atsAnalysis:    { type: String },
  overallScore:   { type: Number, default: null },

  // Platform user link
  platformUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  // Status in the drive pipeline
  status: {
    type: String,
    enum: [
      'APPLIED', 'UNDER_REVIEW', 'SHORTLISTED',
      'AI_TEST_SENT', 'AI_TEST_COMPLETED', 'AI_TEST_PASSED', 'AI_TEST_FAILED',
      'INTERVIEW_SCHEDULED', 'INTERVIEW_DONE',
      'REJECTED', 'SELECTED', 'OFFER_SENT',
    ],
    default: 'APPLIED',
  },

  shortlistedAt: { type: Date },
  selectedAt:    { type: Date },
  rejectedAt:    { type: Date },
  rejectionReason: { type: String },

  // ── AI Skills Test ────────────────────────────────────────────────────────
  aiTest: {
    token:        { type: String },
    sentAt:       { type: Date },
    submittedAt:  { type: Date },
    score:        { type: Number },
    passed:       { type: Boolean },
    questions:    { type: mongoose.Schema.Types.Mixed }, // [{q, options, correct}]
    answers:      { type: mongoose.Schema.Types.Mixed },
    feedback:     { type: String },
    // Questions reviewed/edited by admin (set when admin saves edits)
    questionsReviewed: { type: Boolean, default: false },
  },

  // ── Interview ─────────────────────────────────────────────────────────────
  interview: {
    scheduled:    { type: Boolean, default: false },
    meetLink:     { type: String },
    scheduledAt:  { type: Date },
    notes:        { type: String },
    outcome:      { type: String, enum: ['PENDING', 'PASSED', 'FAILED'], default: 'PENDING' },
  },

  // ── Offer Letter ──────────────────────────────────────────────────────────
  offerLetter: {
    sentAt:       { type: Date },
    acceptToken:  { type: String },
    rejectToken:  { type: String },
    accepted:     { type: Boolean },
    respondedAt:  { type: Date },
    pdfUrl:       { type: String },  // optional Cloudinary URL if needed
  },

  // Internship created from this application
  internship: { type: mongoose.Schema.Types.ObjectId, ref: 'Internship', default: null },

  // Admin notes
  adminNotes: { type: String },

}, { timestamps: true });

driveApplicationSchema.index({ drive: 1, 'student.email': 1 }, { unique: true });
driveApplicationSchema.index({ drive: 1, status: 1 });
driveApplicationSchema.index({ college: 1 });
driveApplicationSchema.index({ atsScore: -1 });

module.exports = mongoose.model('DriveApplication', driveApplicationSchema);
