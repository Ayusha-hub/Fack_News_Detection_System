const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const User = require('../models/User');
const Subscription = require('../models/Subscription');

const router = express.Router();

// JWT authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.userId = decoded.userId;
    next();
  });
};

// Initialize Razorpay - only if valid credentials
let razorpay = null;
if (process.env.RAZORPAY_KEY_ID && 
    process.env.RAZORPAY_KEY_SECRET && 
    process.env.RAZORPAY_KEY_ID !== 'dummy' && 
    process.env.RAZORPAY_KEY_SECRET !== 'dummy') {
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });
}

// Plan configurations
const PLANS = {
  monthly: {
    name: 'Monthly Pro',
    amount: 9900, // 99.00 INR in paise
    currency: 'INR',
    description: 'Monthly Pro subscription',
    duration: 30 // days
  },
  yearly: {
    name: 'Yearly Pro',
    amount: 99900, // 999.00 INR in paise
    currency: 'INR',
    description: 'Yearly Pro subscription',
    duration: 365 // days
  }
};

// POST /create-order - Create Razorpay order
router.post('/create-order', authenticateToken, async (req, res) => {
  try {
    const { plan } = req.body;

    if (!plan || !PLANS[plan]) {
      return res.status(400).json({ error: 'Invalid plan selected' });
    }

    // Check if Razorpay is configured
    if (!razorpay) {
      return res.status(503).json({ 
        error: 'Payment service is not configured. Please contact administrator.',
        code: 'PAYMENT_NOT_CONFIGURED'
      });
    }

    // Check if user already has active subscription
    const activeSubscription = await Subscription.findActiveByUserId(req.userId);
    if (activeSubscription) {
      return res.status(400).json({ 
        error: 'You already have an active subscription',
        activeSubscription: {
          plan: activeSubscription.plan,
          endDate: activeSubscription.endDate,
          daysRemaining: activeSubscription.getDaysRemaining()
        }
      });
    }

    const planConfig = PLANS[plan];

    // Create Razorpay order
    const options = {
      amount: planConfig.amount,
      currency: planConfig.currency,
      receipt: `receipt_${Date.now()}_${req.userId}`,
      notes: {
        userId: req.userId.toString(),
        plan: plan,
        duration: planConfig.duration
      }
    };

    const order = await razorpay.orders.create(options);

    // Create subscription record in database
    const subscription = new Subscription({
      userId: req.userId,
      plan: plan,
      razorpayOrderId: order.id,
      amount: planConfig.amount,
      currency: planConfig.currency,
      status: 'created',
      metadata: {
        originalAmount: planConfig.amount
      }
    });

    await subscription.save();

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      plan: plan,
      planDetails: {
        name: planConfig.name,
        description: planConfig.description,
        duration: planConfig.duration
      }
    });

  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Failed to create payment order' });
  }
});

// POST /verify-payment - Verify Razorpay payment
router.post('/verify-payment', authenticateToken, async (req, res) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({ error: 'Missing payment verification details' });
    }

    // Find subscription record
    const subscription = await Subscription.findOne({
      userId: req.userId,
      razorpayOrderId: razorpayOrderId,
      status: 'created'
    });

    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    // Verify signature
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    if (generatedSignature !== razorpaySignature) {
      await Subscription.findByIdAndUpdate(subscription._id, {
        status: 'failed',
        razorpayPaymentId,
        razorpaySignature
      });
      return res.status(400).json({ error: 'Invalid payment signature' });
    }

    // Update subscription record
    const planConfig = PLANS[subscription.plan];
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + planConfig.duration);

    await Subscription.findByIdAndUpdate(subscription._id, {
      status: 'paid',
      razorpayPaymentId,
      razorpaySignature,
      endDate
    });

    // Update user's subscription status
    await User.findByIdAndUpdate(req.userId, {
      subscriptionStatus: 'pro',
      subscriptionExpiry: endDate
    });

    res.json({
      message: 'Payment verified successfully',
      subscription: {
        plan: subscription.plan,
        status: 'paid',
        endDate: endDate,
        subscriptionStatus: 'pro',
        subscriptionExpiry: endDate
      }
    });

  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({ error: 'Payment verification failed' });
  }
});

// POST /razorpay-webhook - Razorpay webhook for auto-renewal
router.post('/razorpay-webhook', async (req, res) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers['x-razorpay-signature'];
    
    if (!signature) {
      return res.status(400).json({ error: 'Webhook signature missing' });
    }

    // Verify webhook signature
    const body = JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(body)
      .digest('hex');

    if (signature !== expectedSignature) {
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }

    const event = req.body;

    // Handle payment captured event
    if (event.event === 'payment.captured') {
      const payment = event.payload.payment.entity;
      const notes = payment.notes;

      if (notes && notes.userId && notes.plan) {
        const userId = notes.userId;
        const plan = notes.plan;

        // Find the subscription record
        let subscription = await Subscription.findOne({
          userId: userId,
          razorpayOrderId: payment.order_id,
          status: 'created'
        });

        if (!subscription) {
          // Create new subscription for auto-renewal
          const planConfig = PLANS[plan];
          const endDate = new Date();
          endDate.setDate(endDate.getDate() + planConfig.duration);

          subscription = new Subscription({
            userId: userId,
            plan: plan,
            razorpayOrderId: payment.order_id,
            razorpayPaymentId: payment.id,
            razorpaySignature: signature,
            amount: payment.amount,
            currency: payment.currency,
            status: 'paid',
            endDate,
            metadata: {
              razorpaySubscriptionId: payment.subscription_id,
              originalAmount: payment.amount
            }
          });
        } else {
          // Update existing subscription
          const planConfig = PLANS[plan];
          const endDate = new Date();
          endDate.setDate(endDate.getDate() + planConfig.duration);

          subscription.status = 'paid';
          subscription.razorpayPaymentId = payment.id;
          subscription.razorpaySignature = signature;
          subscription.endDate = endDate;
          subscription.renewalAttempts = 0;
        }

        await subscription.save();

        // Update user's subscription status
        await User.findByIdAndUpdate(userId, {
          subscriptionStatus: 'pro',
          subscriptionExpiry: subscription.endDate
        });

        console.log(`Auto-renewal successful for user ${userId}, plan ${plan}`);
      }
    }

    // Handle payment failed event
    else if (event.event === 'payment.failed') {
      const payment = event.payload.payment.entity;
      const notes = payment.notes;

      if (notes && notes.userId && notes.plan) {
        const userId = notes.userId;

        // Update subscription record
        await Subscription.findOneAndUpdate(
          {
            userId: userId,
            razorpayOrderId: payment.order_id,
            status: 'created'
          },
          {
            status: 'failed',
            razorpayPaymentId: payment.id,
            razorpaySignature: signature,
            renewalAttempts: { $inc: 1 },
            lastRenewalAttempt: new Date()
          }
        );

        console.log(`Payment failed for user ${userId}, order ${payment.order_id}`);
      }
    }

    res.status(200).json({ received: true });

  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// GET /subscription-status - Get current subscription status
router.get('/subscription-status', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const activeSubscription = await Subscription.findActiveByUserId(req.userId);

    let subscriptionInfo = {
      status: user.subscriptionStatus,
      expiryDate: user.subscriptionExpiry,
      isActive: false,
      daysRemaining: 0
    };

    if (activeSubscription) {
      subscriptionInfo = {
        status: activeSubscription.status,
        plan: activeSubscription.plan,
        expiryDate: activeSubscription.endDate,
        isActive: activeSubscription.isActive(),
        daysRemaining: activeSubscription.getDaysRemaining(),
        planDetails: activeSubscription.getPlanDetails(),
        autoRenewal: activeSubscription.autoRenewal
      };
    }

    res.json(subscriptionInfo);

  } catch (error) {
    console.error('Get subscription status error:', error);
    res.status(500).json({ error: 'Failed to get subscription status' });
  }
});

// POST /cancel-subscription - Cancel subscription
router.post('/cancel-subscription', authenticateToken, async (req, res) => {
  try {
    const activeSubscription = await Subscription.findActiveByUserId(req.userId);

    if (!activeSubscription) {
      return res.status(404).json({ error: 'No active subscription found' });
    }

    // Update subscription to cancelled
    await Subscription.findByIdAndUpdate(activeSubscription._id, {
      status: 'cancelled',
      autoRenewal: false
    });

    // Update user status to free
    await User.findByIdAndUpdate(req.userId, {
      subscriptionStatus: 'free',
      subscriptionExpiry: null
    });

    res.json({ message: 'Subscription cancelled successfully' });

  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// GET /plans - Get available plans
router.get('/plans', (req, res) => {
  try {
    const plans = Object.keys(PLANS).map(key => ({
      id: key,
      name: PLANS[key].name,
      amount: PLANS[key].amount,
      currency: PLANS[key].currency,
      description: PLANS[key].description,
      duration: PLANS[key].duration,
      features: [
        'Unlimited fact-check analysis',
        'Priority processing',
        'Advanced AI insights',
        'Export results',
        'Priority support',
        key === 'yearly' ? 'Save 20% compared to monthly' : 'Flexible monthly billing'
      ]
    }));

    res.json(plans);

  } catch (error) {
    console.error('Get plans error:', error);
    res.status(500).json({ error: 'Failed to get plans' });
  }
});

module.exports = router;
