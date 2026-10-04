const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const { sendEmail } = require('../services/emailService');

const generateTokens = (userId, role) => {
  const accessToken = jwt.sign({ id: userId, role }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m',
  });
  const refreshToken = jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d',
  });
  return { accessToken, refreshToken };
};

// POST /api/v1/auth/register
exports.register = async (req, res) => {
  try {
    const { email, password, firstName, lastName, role, companyName, collegeId, cohort } = req.body;
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ success: false, message: 'All fields required' });
    }

    const existing = await User.findOne({ email });

    // If email exists but not yet verified → resend verification and return success
    if (existing && !existing.isVerified) {
      const verToken = crypto.randomBytes(32).toString('hex');
      existing.emailVerificationToken = verToken;
      await existing.save({ validateBeforeSave: false });

      // Fire-and-forget: start the promise immediately (no setImmediate/await)
      // so the event loop runs it while response is already sent
      sendEmail(
        email,
        'Verify your HireStorm account',
        `Hi ${existing.profile.firstName}, click the link to verify your email.`,
        `<p>Hi ${existing.profile.firstName}, click below to verify your email:</p><a href="${process.env.CLIENT_URL}/verify-email/${verToken}">Verify Email</a>`
      ).catch(e => console.error('[Register] Email resend failed:', e.message));

      return res.status(201).json({ success: true, message: 'Registration successful. Please check your email to verify your account.' });
    }

    if (existing && existing.isVerified) {
      return res.status(400).json({ success: false, message: 'Email already in use' });
    }

    const allowedRoles = ['STUDENT', 'COMPANY_ADMIN'];
    const assignedRole = allowedRoles.includes(role) ? role : 'STUDENT';

    const verToken = crypto.randomBytes(32).toString('hex');

    const userData = {
      email,
      password,
      role: assignedRole,
      profile: { firstName, lastName },
      emailVerificationToken: verToken,
    };

    if (collegeId && assignedRole === 'STUDENT') {
      const College = require('../models/College');
      const college = await College.findOne({ _id: collegeId, isActive: true }).select('_id');
      if (!college) return res.status(400).json({ success: false, message: 'College not found or inactive' });
      userData.college = college._id;
      userData.cohort = cohort || null;
    }

    // For COMPANY_ADMIN: create Company and link it; also auto-verify so they can login
    if (assignedRole === 'COMPANY_ADMIN') {
      const Company = require('../models/Company');
      const company = await Company.create({
        name: companyName || `${firstName} ${lastName}'s Company`,
        admins: [],
      });
      userData.companyRef = company._id;
      // Auto-verify company accounts so they can post listings immediately
      userData.isVerified = true;

      // Update the company's admins after user creation
      const user = await User.create(userData);
      await Company.findByIdAndUpdate(company._id, { $push: { admins: user._id } });

      // Fire-and-forget welcome email
      sendEmail(
        email,
        'Welcome to HireStorm — Company Account Created',
        `Hi ${firstName}, your company account for "${company.name}" has been created.`,
        `<p>Hi ${firstName}, welcome to HireStorm!</p><p>Your company account for <strong>${company.name}</strong> is ready. You can now post job listings and manage applications.</p><a href="${process.env.CLIENT_URL}/login">Sign in to get started</a>`
      ).catch(e => console.error('[Register] Welcome email failed:', e.message));

      return res.status(201).json({ success: true, message: 'Company account created! You can now sign in.' });
    }

    const user = await User.create(userData);

    // Fire-and-forget: queued immediately in event loop, runs after response
    sendEmail(
      email,
      'Verify your HireStorm account',
      `Hi ${firstName}, click the link to verify your email.`,
      `<p>Hi ${firstName}, click below to verify your email:</p><a href="${process.env.CLIENT_URL}/verify-email/${verToken}">Verify Email</a>`
    ).catch(e => console.error('[Register] Verification email failed:', e.message));

    res.status(201).json({ success: true, message: 'Registration successful. Please check your email to verify your account.' });
  } catch (err) {
    console.error('[Register] Error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};


// POST /api/v1/auth/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const { accessToken, refreshToken } = generateTokens(user._id, user.role);
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ success: true, accessToken, user: user.toPublicProfile() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/v1/auth/refresh-token
exports.refreshToken = async (req, res) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) return res.status(401).json({ success: false, message: 'No refresh token' });

    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);
    if (!user || user.refreshToken !== token) {
      return res.status(401).json({ success: false, message: 'Invalid refresh token' });
    }

    const { accessToken, refreshToken } = generateTokens(user._id, user.role);
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.json({ success: true, accessToken });
  } catch (err) {
    res.status(401).json({ success: false, message: 'Token expired or invalid' });
  }
};

// POST /api/v1/auth/logout
exports.logout = async (req, res) => {
  try {
    if (req.user) {
      await User.findByIdAndUpdate(req.user._id, { refreshToken: null });
    }
    res.clearCookie('refreshToken');
    res.json({ success: true, message: 'Logged out' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/v1/auth/verify-email/:token
exports.verifyEmail = async (req, res) => {
  try {
    const user = await User.findOne({ emailVerificationToken: req.params.token });
    if (!user) return res.status(400).json({ success: false, message: 'Invalid token' });
    user.isVerified = true;
    user.emailVerificationToken = undefined;
    await user.save({ validateBeforeSave: false });
    res.json({ success: true, message: 'Email verified' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/v1/auth/forgot-password
exports.forgotPassword = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) return res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = resetToken;
    user.passwordResetExpiry = Date.now() + 30 * 60 * 1000;
    await user.save({ validateBeforeSave: false });

    await sendEmail(
      user.email,
      'Password Reset Request',
      `Click the link to reset your password.`,
      `<p>Click below to reset your password (expires in 30 minutes):</p><a href="${process.env.CLIENT_URL}/reset-password/${resetToken}">Reset Password</a>`
    );
    res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/v1/auth/reset-password/:token
exports.resetPassword = async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }
    const user = await User.findOne({
      passwordResetToken: req.params.token,
      passwordResetExpiry: { $gt: Date.now() },
    });
    if (!user) {
      return res.status(400).json({ success: false, message: 'Reset link is invalid or has expired. Please request a new one.' });
    }
    user.password = password; // pre-save hook will hash it
    user.passwordResetToken  = undefined;
    user.passwordResetExpiry = undefined;
    user.refreshToken        = null; // invalidate all sessions
    await user.save();
    res.json({ success: true, message: 'Password reset successfully. Please log in.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/v1/auth/resend-verification
exports.resendVerification = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    const user = await User.findOne({ email });
    // Always return success to avoid email enumeration
    if (!user || user.isVerified) {
      return res.json({ success: true, message: 'If that account exists and is unverified, a new verification email has been sent.' });
    }

    const verToken = crypto.randomBytes(32).toString('hex');
    user.emailVerificationToken = verToken;
    await user.save({ validateBeforeSave: false });

    // Fire-and-forget: queued immediately in event loop, runs after response
    sendEmail(
      email,
      'Verify your HireStorm account',
      `Hi ${user.profile.firstName}, click the link to verify your email.`,
      `<p>Hi ${user.profile.firstName}, click below to verify your HireStorm email:</p><a href="${process.env.CLIENT_URL}/verify-email/${verToken}">Verify Email</a>`
    ).catch(e => console.error('[ResendVerification] Email failed:', e.message));

    res.json({ success: true, message: 'Verification email resent! Please check your inbox.' });
  } catch (err) {
    console.error('[ResendVerification] Error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

const Company = require('../models/Company');

// GET /api/v1/auth/me
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('companyRef').populate('activeInternship');
    res.json({ success: true, user: { ...user.toPublicProfile(), company: user.companyRef } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/v1/auth/company
exports.updateCompany = async (req, res) => {
  try {
    const { name, industry, website, description, email, phone } = req.body;
    let company;
    if (req.user.companyRef) {
      company = await Company.findByIdAndUpdate(
        req.user.companyRef,
        { name, industry, website, description, email, phone },
        { new: true }
      );
    } else {
      company = await Company.create({
        name: name || 'My Company',
        industry, website, description, email, phone,
        admins: [req.user._id]
      });
      await User.findByIdAndUpdate(req.user._id, { companyRef: company._id });
    }
    
    // Give user back the updated public profile
    const user = await User.findById(req.user._id).populate('companyRef');
    res.json({ success: true, user: { ...user.toPublicProfile(), company: user.companyRef } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/v1/auth/profile
exports.updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, bio, skills, phone, links, education, experience, location } = req.body;
    const updateData = {};
    if (firstName  !== undefined) updateData['profile.firstName']  = firstName;
    if (lastName   !== undefined) updateData['profile.lastName']   = lastName;
    if (bio        !== undefined) updateData['profile.bio']        = bio;
    if (phone      !== undefined) updateData['profile.phone']      = phone;
    // Skills can be at top-level or inside profile — store at profile.skills
    if (skills     !== undefined) updateData['profile.skills']     = skills;
    // Links object (sent as { linkedin, github, portfolio })
    if (links      !== undefined) {
      if (links.linkedin  !== undefined) updateData['profile.links.linkedin']  = links.linkedin;
      if (links.github    !== undefined) updateData['profile.links.github']    = links.github;
      if (links.portfolio !== undefined) updateData['profile.links.portfolio'] = links.portfolio;
    }
    // Education object
    if (education  !== undefined) {
      if (education.institution !== undefined) updateData['profile.institution'] = education.institution;
      if (education.degree      !== undefined) updateData['profile.degree']      = education.degree;
    }
    if (experience !== undefined) updateData['profile.experience'] = experience;
    if (location   !== undefined) updateData['profile.location']   = location;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updateData },
      { new: true, runValidators: false }
    ).populate('companyRef');

    res.json({ success: true, user: { ...user.toPublicProfile(), company: user.companyRef } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/v1/auth/avatar
exports.uploadAvatar = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No image uploaded' });
    const { uploadToCloudinary } = require('../middleware/upload');
    const result = await uploadToCloudinary(
      req.file.buffer,
      'hirestorm/avatars',
      `user_${req.user._id}`
    );
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { 'profile.avatar': result.secure_url },
      { new: true }
    ).populate('companyRef');
    res.json({
      success: true,
      avatarUrl: result.secure_url,
      user: { ...user.toPublicProfile(), company: user.companyRef },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
