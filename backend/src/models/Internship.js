const mongoose = require('mongoose');

const internshipSchema = new mongoose.Schema({
  intern: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  mentor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  team:      { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
  hackathon: { type: mongoose.Schema.Types.ObjectId, ref: 'Hackathon' },
  company:   { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },

  // Source of internship
  source:      { type: String, enum: ['HACKATHON', 'CAMPUS_DRIVE', 'DIRECT'], default: 'HACKATHON' },
  campusDrive: { type: mongoose.Schema.Types.ObjectId, ref: 'CampusDrive', default: null },
  college:     { type: mongoose.Schema.Types.ObjectId, ref: 'College',     default: null },
  cohort:      { type: String, trim: true, default: null },

  startDate: { type: Date },
  endDate:   { type: Date },
  durationDays: { type: Number, enum: [90, 180, 360], default: 90 },

  status: {
    type: String,
    enum: ['OFFER_SENT', 'ACCEPTED', 'REJECTED', 'ACTIVE', 'COMPLETED', 'TERMINATED', 'FAILED_ASSESSMENT'],
    default: 'OFFER_SENT',
  },

  // Offer flow
  acceptToken:     { type: String },
  rejectToken:     { type: String },
  offerPdfUrl:     { type: String },
  offerLetterUrl:  { type: String },
  offerStatus:     { type: String, enum: ['PENDING', 'ACCEPTED', 'REJECTED'], default: 'PENDING' },
  offerAcceptedAt: { type: Date },

  // Stipend
  stipend: {
    amount:   { type: Number, default: 10000 },
    currency: { type: String, default: 'INR' },
  },

  // Work Breakdown Structure (13 weeks × tasks)
  wbs: [{
    week:  Number,
    topic: String,
    tasks: [{
      task:   String,
      status: { type: String, enum: ['PENDING', 'DONE'], default: 'PENDING' },
    }],
  }],

  // Daily logs
  dailyLogs: [{
    date:        { type: Date, required: true },
    task:        { type: String },          // legacy / used by old ilm.controller
    workDone:    { type: String },          // used by new DailyLog.jsx
    blockers:    { type: String, default: '' },
    update:      { type: String },          // nextSteps alias
    hoursWorked: { type: Number },
    status:      { type: String, enum: ['SUBMITTED', 'REVIEWED', 'PENDING'], default: 'SUBMITTED' },
    mentorScore: { type: Number, min: 0, max: 10 },
    comments: [{
      role: { type: String, enum: ['MENTOR', 'INTERN'] },
      message: { type: String, required: true },
      createdAt: { type: Date, default: Date.now }
    }],
  }],

  // Monthly reviews (3 months)
  monthlyReviews: [{
    month:      { type: Number, required: true }, // 1, 2, or 3
    reviewDate: { type: Date },
    rubric: {
      taskCompletion: { type: Number, default: 0, min: 0, max: 25 },
      codeQuality:    { type: Number, default: 0, min: 0, max: 25 },
      communication:  { type: Number, default: 0, min: 0, max: 25 },
      initiative:     { type: Number, default: 0, min: 0, max: 25 },
    },
    totalScore:  { type: Number, default: 0 },
    feedback:    { type: String, default: '' },
    status:      { type: String, enum: ['PENDING', 'COMPLETED'], default: 'PENDING' },
    reviewedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  }],

  // Continuous assessment aggregated score
  continuousAssessmentScore: { type: Number, default: 0 },
  assessmentThreshold:       { type: Number, default: 60 },

  // Final exam
  isExamUnlocked: { type: Boolean, default: false },
  exam: {
    attemptedAt: Date,
    score:       Number,
    isPassed:    Boolean,
    passMark:    { type: Number, default: 40 },
  },

  // Certificate
  certificate: {
    isGenerated:    { type: Boolean, default: false },
    certificateId:  String,
    certificateUrl: String,
    issuedAt:       Date,
    linkedinShared: { type: Boolean, default: false },
  },
}, { timestamps: true });

internshipSchema.index({ intern: 1, status: 1 });
internshipSchema.index({ mentor: 1 });
internshipSchema.index({ hackathon: 1 });
internshipSchema.index({ college: 1, cohort: 1, status: 1 });

module.exports = mongoose.model('Internship', internshipSchema);
