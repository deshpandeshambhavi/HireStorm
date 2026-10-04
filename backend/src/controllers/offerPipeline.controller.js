const Team        = require('../models/Team');
const User        = require('../models/User');
const Internship  = require('../models/Internship');
const Hackathon   = require('../models/Hackathon');
const crypto      = require('crypto');
const { sendInternshipOffer, sendOfferAcceptedConfirmation } = require('../services/emailService');
const { notify }  = require('../services/notificationService');

/**
 * POST /api/v1/hackathons/:hackathonId/teams/:teamId/select-winner
 * Marks a team as WINNER and sends offer letters to ALL members.
 */
exports.selectWinningTeam = async (req, res) => {
  try {
    const { hackathonId, teamId } = req.params;

    const team = await Team.findOne({ _id: teamId, hackathon: hackathonId })
      .populate('members.user', 'email profile college cohort')
      .populate('leader', 'email profile college cohort');

    if (!team) return res.status(404).json({ success: false, message: 'Team not found' });

    team.stage = 'WINNER';
    await team.save();

    const hack = await Hackathon.findById(hackathonId);
    const durationDays = hack?.internshipDuration || 90;

    const superAdmin = await User.findOne({ role: 'SUPER_ADMIN' });
    const mentorId = superAdmin ? superAdmin._id : process.env.DEFAULT_ADMIN_ID;
    const results  = [];

    // Create offer for every team member (not just leader)
    for (const mem of team.members) {
      const member = mem.user;
      if (!member) continue;

      const studentName = `${member.profile?.firstName || ''} ${member.profile?.lastName || ''}`.trim() || 'Student';

      const acceptToken = crypto.randomBytes(32).toString('hex');
      const rejectToken = crypto.randomBytes(32).toString('hex');

      const internship = await Internship.create({
        intern:       member._id,
        mentor:       mentorId || member._id,
        team:         team._id,
        hackathon:    hackathonId,
        college:      member.college || null,
        cohort:       member.cohort || null,
        status:       'OFFER_SENT',
        acceptToken,
        rejectToken,
        offerStatus:  'PENDING',
        durationDays,
      });

      // Build backend download URL (no Cloudinary)
      const apiBase = process.env.API_URL || 'http://localhost:5000';
      const pdfUrl  = `${apiBase}/api/v1/ilm/offer-letter/download/${internship._id}`;
      internship.offerPdfUrl = pdfUrl;
      await internship.save();

      // Update user role
      await User.findByIdAndUpdate(member._id, { role: 'INTERN' });

      const acceptUrl = `${process.env.API_URL || 'http://localhost:5000'}/api/v1/internship/accept?token=${acceptToken}`;
      const rejectUrl = `${process.env.API_URL || 'http://localhost:5000'}/api/v1/internship/reject?token=${rejectToken}`;

      if (member.email) {
        await sendInternshipOffer(member.email, studentName, team.name, pdfUrl, acceptUrl, rejectUrl, durationDays);
      }


      await notify({
        recipientId: member._id,
        type:    'INTERNSHIP_OFFER',
        title:   '🎊 Internship Offer from Innobytes!',
        message: `Congratulations! You have been offered a ${durationDays}-Day Internship at Innobytes. Please accept or reject through the platform.`,
        link:    '/internship/offer',
        channel: ['IN_APP'],
      });

      results.push({ memberId: member._id, studentName, internshipId: internship._id });
    }

    res.json({
      success: true,
      message: `Team "${team.name}" declared winner. Offer letters sent to ${results.length} member(s).`,
      data:    results,
    });
  } catch (err) {
    console.error('[selectWinningTeam]', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/v1/internship/accept?token=xxx
 * Magic link — student accepts offer from email.
 */
exports.acceptOffer = async (req, res) => {
  try {
    const { token } = req.query;
    const internship = await Internship.findOne({ acceptToken: token }).populate('intern', 'email profile');
    if (!internship) return res.status(400).send('<h2 style="font-family:sans-serif;color:#f87171">Invalid or expired link.</h2>');

    internship.offerStatus = 'ACCEPTED';
    internship.status      = 'ACTIVE';
    internship.startDate   = new Date();
    const duration         = internship.durationDays || 90;
    internship.endDate     = new Date(Date.now() + duration * 24 * 60 * 60 * 1000);
    internship.acceptToken = undefined;
    internship.rejectToken = undefined;
    await internship.save();

    await User.findByIdAndUpdate(internship.intern._id, { role: 'INTERN', activeInternship: internship._id });

    const name = `${internship.intern.profile?.firstName || ''} ${internship.intern.profile?.lastName || ''}`.trim();
    if (internship.intern.email) {
      await sendOfferAcceptedConfirmation(internship.intern.email, name, internship.durationDays || 90);
    }

    res.send(`
      <html><body style="font-family:sans-serif;background:#0f1623;color:#e8edf8;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0">
        <div style="text-align:center;padding:40px">
          <h1 style="color:#34d399;font-size:2rem">🎉 Offer Accepted!</h1>
          <p style="color:#8a9ac0">Welcome to Innobytes! You can now log in to the platform to start your ${internship.durationDays || 90}-day internship journey.</p>
          <a href="${process.env.CLIENT_URL}/dashboard" style="display:inline-block;margin-top:20px;padding:12px 28px;background:#4f7ef8;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold">Go to Dashboard</a>
        </div>
      </body></html>
    `);
  } catch (err) {
    res.status(500).send('<h2>Server error. Please contact support.</h2>');
  }
};

/**
 * GET /api/v1/internship/reject?token=xxx
 */
exports.rejectOffer = async (req, res) => {
  try {
    const { token } = req.query;
    const internship = await Internship.findOne({ rejectToken: token });
    if (!internship) return res.status(400).send('<h2 style="font-family:sans-serif;color:#f87171">Invalid or expired link.</h2>');

    internship.offerStatus = 'REJECTED';
    internship.status      = 'REJECTED';
    internship.acceptToken = undefined;
    internship.rejectToken = undefined;
    await internship.save();

    res.send(`
      <html><body style="font-family:sans-serif;background:#0f1623;color:#e8edf8;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0">
        <div style="text-align:center;padding:40px">
          <h1 style="color:#f87171">Offer Declined</h1>
          <p style="color:#8a9ac0">We respect your decision. Good luck with your future endeavors!</p>
          <a href="${process.env.CLIENT_URL}" style="display:inline-block;margin-top:20px;padding:12px 28px;background:#4f7ef8;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold">Go to Home</a>
        </div>
      </body></html>
    `);
  } catch (err) {
    res.status(500).send('<h2>Server error.</h2>');
  }
};

/**
 * POST /api/v1/internship/:id/accept  (platform button — authenticated)
 */
exports.acceptOfferPlatform = async (req, res) => {
  try {
    const internship = await Internship.findOne({ _id: req.params.id, intern: req.user._id }).populate('intern', 'email profile');
    if (!internship) return res.status(404).json({ success: false, message: 'Internship offer not found' });
    if (internship.offerStatus !== 'PENDING') return res.status(400).json({ success: false, message: 'Offer already responded to' });

    internship.offerStatus = 'ACCEPTED';
    internship.status      = 'ACTIVE';
    internship.startDate   = new Date();
    const duration         = internship.durationDays || 90;
    internship.endDate     = new Date(Date.now() + duration * 24 * 60 * 60 * 1000);
    internship.acceptToken = undefined;
    internship.rejectToken = undefined;
    await internship.save();

    await User.findByIdAndUpdate(req.user._id, { role: 'INTERN', activeInternship: internship._id });

    const name = `${internship.intern.profile?.firstName || ''} ${internship.intern.profile?.lastName || ''}`.trim();
    if (internship.intern.email) await sendOfferAcceptedConfirmation(internship.intern.email, name, internship.durationDays || 90);

    res.json({ success: true, message: 'Offer accepted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/v1/internship/:id/reject  (platform button — authenticated)
 */
exports.rejectOfferPlatform = async (req, res) => {
  try {
    const internship = await Internship.findOne({ _id: req.params.id, intern: req.user._id });
    if (!internship) return res.status(404).json({ success: false, message: 'Internship offer not found' });
    if (internship.offerStatus !== 'PENDING') return res.status(400).json({ success: false, message: 'Already responded' });

    internship.offerStatus = 'REJECTED';
    internship.status      = 'REJECTED';
    internship.acceptToken = undefined;
    internship.rejectToken = undefined;
    await internship.save();

    res.json({ success: true, message: 'Offer declined.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getMyOffer = async (req, res) => {
  try {
    const internship = await Internship.findOne({ intern: req.user._id, offerStatus: 'PENDING' })
      .populate('team', 'name')
      .populate('hackathon', 'title');
    res.json({ success: true, data: internship || null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
