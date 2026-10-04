const mongoose = require('mongoose');

// ── Sub-schema: a single Job Description ──────────────────────────────────────
const jdSchema = new mongoose.Schema({
  role:                { type: String },
  skills:              [String],
  stipend:             { type: Number },
  duration:            { type: String },
  eligibility:         { type: String },
  minCGPA:             { type: Number, default: 6.0 },
  eligibleDisciplines: [String],
  description:         { type: String },
  attachmentUrl:       { type: String },
}, { _id: true });

const campusDriveSchema = new mongoose.Schema({
  college:  { type: mongoose.Schema.Types.ObjectId, ref: 'College', required: true },
  cohort:   { type: String, trim: true, default: null },
  company:  { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
  createdBy:{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  title:       { type: String, required: true },
  description: { type: String },
  driveDate:   { type: Date },
  venue:       { type: String },
  mode:        { type: String, enum: ['OFFLINE', 'ONLINE', 'HYBRID'], default: 'OFFLINE' },

  // ── Legacy single JD (kept for backward-compat) ────────────────────────────
  jd: {
    role:                { type: String },
    skills:              [String],
    stipend:             { type: Number },
    duration:            { type: String },
    eligibility:         { type: String },
    minCGPA:             { type: Number, default: 6.0 },
    eligibleDisciplines: [String],
    description:         { type: String },
    attachmentUrl:       { type: String },
  },

  // ── Multiple JDs (new) ─────────────────────────────────────────────────────
  jds: [jdSchema],  // Array of job descriptions, one per role/position

  // Form link students fill
  applicationFormUrl: { type: String },
  applicationFormToken: { type: String, unique: true, sparse: true },

  status: {
    type: String,
    enum: ['DRAFT', 'JD_SENT', 'APPLICATIONS_OPEN', 'SHORTLISTING', 'SHORTLISTED', 'FURTHER_ROUNDS', 'COMPLETED', 'CANCELLED'],
    default: 'DRAFT',
  },

  // Shortlisting config
  shortlistingCriteria: {
    minATSScore: { type: Number, default: 60 },
    minCGPA:     { type: Number, default: 6.0 },
    minClass10:  { type: Number, default: 60 },
    minClass12:  { type: Number, default: 60 },
    slots:       { type: Number, default: 20 },
  },

  // ── MCQ Test Configuration ─────────────────────────────────────────────────
  mcqConfig: {
    passingScore:  { type: Number, default: 60 },    // % to pass
    timeLimit:     { type: Number, default: 20 },    // minutes
    questionCount: { type: Number, default: 10 },    // number of questions to generate
  },

  // ── Selection Pipeline Config ──────────────────────────────────────────────
  enableInterviewRound: { type: Boolean, default: false }, // if true: AI Test → Interview → Offer; if false: AI Test → Offer

  // ── Offer Letter Template ──────────────────────────────────────────────────
  offerLetterTemplate: {
    companyName:     { type: String, default: 'HireStorm / Innobytes' },
    signatoryName:   { type: String, default: 'HR Team' },
    signatoryTitle:  { type: String, default: 'Campus Placement Division, HireStorm' },
    logoUrl:         { type: String },                 // optional custom logo
    customTerms:     [String],                         // replaces default terms if non-empty
    footerText:      { type: String },
  },

  // Rounds after shortlisting
  rounds: [{
    roundNo:     { type: Number },
    roundName:   { type: String },
    scheduledAt: { type: Date },
    status:      { type: String, enum: ['UPCOMING', 'ONGOING', 'COMPLETED'], default: 'UPCOMING' },
    notes:       { type: String },
  }],

  // Aggregate stats
  totalApplicants:  { type: Number, default: 0 },
  totalShortlisted: { type: Number, default: 0 },
  totalSelected:    { type: Number, default: 0 },

}, { timestamps: true });

campusDriveSchema.index({ college: 1, status: 1 });
campusDriveSchema.index({ college: 1, cohort: 1, status: 1 });

module.exports = mongoose.model('CampusDrive', campusDriveSchema);
