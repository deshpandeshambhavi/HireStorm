const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['STUDENT', 'PRO_STUDENT', 'INTERN', 'MENTOR', 'COMPANY_HR', 'COMPANY_ADMIN', 'PLATFORM_ADMIN', 'SUPER_ADMIN'],
    default: 'STUDENT' 
  },
  profile: {
    firstName: { type: String },
    lastName: { type: String },
    avatar: String,
    resume: String,
    bio: String,
    phone: String,
    location: String,
    institution: String,
    degree: String,
    experience: String,
    skills: [String],
    links: {
      linkedin: String,
      github: String,
      portfolio: String
    }
  },
  isActive: { type: Boolean, default: true },
  isVerified: { type: Boolean, default: false },
  emailVerificationToken: String,
  passwordResetToken: String,
  passwordResetExpiry: Date,
  refreshToken: String,
  companyRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
  college: { type: mongoose.Schema.Types.ObjectId, ref: 'College', default: null },
  cohort: { type: String, trim: true, default: null },
  activeInternship: { type: mongoose.Schema.Types.ObjectId, ref: 'Internship', default: null },
  profileViews: [{ viewedBy: mongoose.Schema.Types.ObjectId, viewedAt: Date }]
}, { timestamps: true });

// Hash password before save
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare raw password to hashed password
userSchema.methods.comparePassword = async function(candidate) {
  return await bcrypt.compare(candidate, this.password);
};

// Return public profile stripping out sensitive data
userSchema.methods.toPublicProfile = function() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.refreshToken;
  delete obj.emailVerificationToken;
  delete obj.passwordResetToken;
  delete obj.passwordResetExpiry;
  return obj;
};

userSchema.index({ role: 1 });
userSchema.index({ activeInternship: 1 });
userSchema.index({ college: 1, cohort: 1, role: 1 });

module.exports = mongoose.model('User', userSchema);
