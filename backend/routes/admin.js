const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Analysis = require('../models/Analysis');
const Subscription = require('../models/Subscription');
const nodemailer = require('nodemailer');
const twilio = require('twilio');

const router = express.Router();

// Admin authentication middleware
const authenticateAdmin = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    try {
      // Check if user is admin
      const user = await User.findById(decoded.userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      req.userId = decoded.userId;
      next();
    } catch (error) {
      console.error('Admin authentication error:', error);
      return res.status(500).json({ error: 'Authentication failed' });
    }
  });
};

// Email transporter - only if valid config
let emailTransporter = null;
if (process.env.EMAIL_USER && process.env.EMAIL_USER !== 'dummy' && process.env.EMAIL_PASS && process.env.EMAIL_PASS !== 'dummy') {
    emailTransporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.EMAIL_PORT) || 587,
        secure: false,
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });
}

// Twilio client - only if valid SID
let twilioClient = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_ACCOUNT_SID.startsWith('AC') && 
    process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_AUTH_TOKEN !== 'dummy') {
    twilioClient = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}
// GET /users - List all users with pagination
router.get('/users', authenticateAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;
    const { search, role, subscriptionStatus } = req.query;

    // Build filter
    const filter = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    if (role) {
      filter.role = role;
    }
    if (subscriptionStatus) {
      filter.subscriptionStatus = subscriptionStatus;
    }

    // Get users with pagination
    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments(filter);

    // Get subscription info for each user
    const usersWithSubscriptions = await Promise.all(
      users.map(async (user) => {
        const activeSubscription = await Subscription.findActiveByUserId(user._id);
        return {
          ...user.toObject(),
          activeSubscription: activeSubscription ? {
            plan: activeSubscription.plan,
            endDate: activeSubscription.endDate,
            daysRemaining: activeSubscription.getDaysRemaining()
          } : null
        };
      })
    );

    res.json({
      users: usersWithSubscriptions,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalUsers: total,
        hasMore: skip + users.length < total
      }
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET /stats - Get dashboard statistics
router.get('/stats', authenticateAdmin, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Basic stats
    const totalUsers = await User.countDocuments();
    const activeSubscriptions = await Subscription.countDocuments({
      status: 'paid',
      endDate: { $gt: new Date() }
    });
    const totalAnalyses = await Analysis.countDocuments();

    // Subscription breakdown
    const subscriptionStats = await User.aggregate([
      {
        $group: {
          _id: '$subscriptionStatus',
          count: { $sum: 1 }
        }
      }
    ]);

    // Analyses per day
    const analysesPerDay = await Analysis.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt'
            }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Top fake news categories
    const verdictBreakdown = await Analysis.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          verdict: { $in: ['Fake', 'Misleading'] }
        }
      },
      {
        $group: {
          _id: '$verdict',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    // User growth over time
    const userGrowth = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt'
            }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Revenue stats
    const revenueStats = await Subscription.aggregate([
      {
        $match: {
          status: 'paid',
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$plan',
          count: { $sum: 1 },
          revenue: { $sum: '$amount' }
        }
      }
    ]);

    res.json({
      overview: {
        totalUsers,
        activeSubscriptions,
        totalAnalyses,
        conversionRate: totalUsers > 0 ? ((activeSubscriptions / totalUsers) * 100).toFixed(2) : 0
      },
      subscriptionBreakdown: subscriptionStats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {}),
      analysesPerDay,
      verdictBreakdown,
      userGrowth,
      revenueStats,
      period: `${days} days`
    });

  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// POST /broadcast - Send broadcast message
router.post('/broadcast', authenticateAdmin, async (req, res) => {
  try {
    const { message, subject, channels, targetAudience } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    if (!channels || channels.length === 0) {
      return res.status(400).json({ error: 'At least one channel must be selected' });
    }

    // Build user filter
    const userFilter = {};
    if (targetAudience && targetAudience !== 'all') {
      userFilter.subscriptionStatus = targetAudience;
    }

    const users = await User.find(userFilter);
    
    if (users.length === 0) {
      return res.status(404).json({ error: 'No users found for the specified audience' });
    }

    const results = {
      email: { sent: 0, failed: 0, errors: [] },
      whatsapp: { sent: 0, failed: 0, errors: [] }
    };

    // Send emails
    if (channels.includes('email')) {
      try {
        const mailOptions = {
          from: `"Sachet" <${process.env.SMTP_USER}>`,
          subject: subject || 'Important Update from Sachet',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center;">
                <h1 style="color: white; margin: 0;">Sachet</h1>
                <p style="color: rgba(255,255,255,0.9); margin: 5px 0;">Your Trusted Fact-Checking Companion</p>
              </div>
              <div style="background: white; padding: 30px;">
                <div style="color: #333; line-height: 1.6; white-space: pre-wrap;">${message}</div>
                <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                <p style="color: #666; font-size: 14px; text-align: center;">
                  This message was sent to you because you are a registered user of Sachet.<br>
                  If you no longer wish to receive these emails, please contact support.
                </p>
              </div>
            </div>
          `
        };

        // Send to all users (BCC)
        const emailPromises = users.map(async (user) => {
          try {
            await emailTransporter.sendMail({
              ...mailOptions,
              to: user.email
            });
            results.email.sent++;
          } catch (error) {
            results.email.failed++;
            results.email.errors.push(`Failed to send to ${user.email}: ${error.message}`);
          }
        });

        await Promise.all(emailPromises);

      } catch (error) {
        console.error('Email broadcast error:', error);
        results.email.errors.push(`Email service error: ${error.message}`);
      }
    }

    // Send WhatsApp messages
    if (channels.includes('whatsapp')) {
      try {
        const whatsappPromises = users.map(async (user) => {
          try {
            // Note: This requires users to have phone numbers and WhatsApp integration
            // For demo purposes, we'll simulate the sending
            if (user.phone) {
              const messageOptions = {
                body: message,
                from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
                to: `whatsapp:${user.phone}`
              };

              await twilioClient.messages.create(messageOptions);
              results.whatsapp.sent++;
            }
          } catch (error) {
            results.whatsapp.failed++;
            results.whatsapp.errors.push(`Failed to send WhatsApp to ${user.email}: ${error.message}`);
          }
        });

        await Promise.all(whatsappPromises);

      } catch (error) {
        console.error('WhatsApp broadcast error:', error);
        results.whatsapp.errors.push(`WhatsApp service error: ${error.message}`);
      }
    }

    res.json({
      message: 'Broadcast completed',
      totalUsers: users.length,
      results
    });

  } catch (error) {
    console.error('Broadcast error:', error);
    res.status(500).json({ error: 'Broadcast failed' });
  }
});

// PUT /user/:userId/subscription - Manually update subscription
router.put('/user/:userId/subscription', authenticateAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { plan, status, endDate, reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update user subscription status
    const updateData = {
      subscriptionStatus: status || 'free',
      subscriptionExpiry: endDate || null
    };

    await User.findByIdAndUpdate(userId, updateData);

    // If granting paid subscription, create/update subscription record
    if (status === 'pro' && plan) {
      const subscriptionData = {
        userId: userId,
        plan: plan,
        razorpayOrderId: `admin_manual_${Date.now()}`,
        status: 'paid',
        amount: plan === 'monthly' ? 9900 : 99900,
        currency: 'INR',
        endDate: new Date(endDate),
        metadata: {
          updatedBy: req.userId,
          updateReason: reason || 'Admin manual update',
          manualUpdate: true
        }
      };

      // Cancel existing subscriptions
      await Subscription.updateMany(
        { userId: userId, status: { $in: ['created', 'paid'] } },
        { status: 'cancelled' }
      );

      // Create new subscription
      await Subscription.create(subscriptionData);
    } else if (status === 'free') {
      // Cancel active subscriptions
      await Subscription.updateMany(
        { userId: userId, status: { $in: ['created', 'paid'] } },
        { status: 'cancelled' }
      );
    }

    // Log the admin action
    console.log(`Admin ${req.userId} updated subscription for user ${userId}:`, {
      plan, status, endDate, reason
    });

    res.json({
      message: 'Subscription updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        subscriptionStatus: updateData.subscriptionStatus,
        subscriptionExpiry: updateData.subscriptionExpiry
      }
    });

  } catch (error) {
    console.error('Update subscription error:', error);
    res.status(500).json({ error: 'Failed to update subscription' });
  }
});

// DELETE /user/:userId - Delete user (admin only)
router.delete('/user/:userId', authenticateAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent admin from deleting themselves
    if (userId === req.userId) {
      return res.status(400).json({ error: 'Cannot delete your own admin account' });
    }

    // Delete user and related data
    await User.findByIdAndDelete(userId);
    await Subscription.deleteMany({ userId: userId });
    await Analysis.deleteMany({ userId: userId });

    console.log(`Admin ${req.userId} deleted user ${userId}:`, {
      userName: user.name,
      userEmail: user.email
    });

    res.json({
      message: 'User deleted successfully',
      deletedUser: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// GET /logs - Get system logs (simplified version)
router.get('/logs', authenticateAdmin, async (req, res) => {
  try {
    const { type = 'all', limit = 100 } = req.query;

    // In a real implementation, you'd query a logs collection
    // For now, return recent admin actions
    const logs = [
      {
        timestamp: new Date(),
        type: 'admin_action',
        message: 'Admin dashboard accessed',
        userId: req.userId
      }
    ];

    res.json({
      logs: logs.slice(0, parseInt(limit)),
      total: logs.length
    });

  } catch (error) {
    console.error('Get logs error:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

module.exports = router;
