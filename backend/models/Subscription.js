const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },
  plan: {
    type: String,
    enum: ['monthly', 'yearly'],
    required: [true, 'Plan is required']
  },
  razorpayOrderId: {
    type: String,
    required: [true, 'Razorpay Order ID is required'],
    unique: true,
    index: true
  },
  razorpayPaymentId: {
    type: String,
    sparse: true
  },
  razorpaySignature: {
    type: String,
    sparse: true
  },
  status: {
    type: String,
    enum: ['created', 'paid', 'failed', 'cancelled'],
    default: 'created',
    required: true
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0, 'Amount cannot be negative']
  },
  currency: {
    type: String,
    default: 'INR',
    enum: ['INR', 'USD']
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required']
  },
  autoRenewal: {
    type: Boolean,
    default: true
  },
  renewalAttempts: {
    type: Number,
    default: 0
  },
  lastRenewalAttempt: {
    type: Date
  },
  metadata: {
    razorpaySubscriptionId: String,
    razorpayCustomerId: String,
    originalAmount: Number,
    discountApplied: Number,
    promoCode: String
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
subscriptionSchema.index({ userId: 1, status: 1 });
subscriptionSchema.index({ razorpayOrderId: 1 });
subscriptionSchema.index({ endDate: 1 });
subscriptionSchema.index({ status: 1, endDate: 1 });

// Method to check if subscription is active
subscriptionSchema.methods.isActive = function() {
  return this.status === 'paid' && this.endDate > new Date();
};

// Method to get days remaining
subscriptionSchema.methods.getDaysRemaining = function() {
  if (!this.isActive()) return 0;
  const today = new Date();
  const diffTime = this.endDate - today;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// Method to get plan details
subscriptionSchema.methods.getPlanDetails = function() {
  const plans = {
    monthly: {
      name: 'Monthly',
      duration: 30,
      price: 99,
      currency: 'INR',
      features: ['Unlimited analysis', 'Priority support', 'Advanced features']
    },
    yearly: {
      name: 'Yearly',
      duration: 365,
      price: 999,
      currency: 'INR',
      features: ['Unlimited analysis', 'Priority support', 'Advanced features', '2 months free']
    }
  };
  
  return plans[this.plan] || plans.monthly;
};

// Static method to find active subscription
subscriptionSchema.statics.findActiveByUserId = function(userId) {
  return this.findOne({
    userId: userId,
    status: 'paid',
    endDate: { $gt: new Date() }
  }).sort({ endDate: -1 });
};

// Static method to find expiring subscriptions
subscriptionSchema.statics.findExpiringSoon = function(days = 7) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);
  
  return this.find({
    status: 'paid',
    endDate: { $lte: futureDate, $gt: new Date() },
    autoRenewal: true
  }).populate('userId');
};

// Pre-save middleware to set end date based on plan
subscriptionSchema.pre('save', function(next) {
  if (this.isNew && !this.endDate) {
    const planDetails = this.getPlanDetails();
    this.endDate = new Date();
    this.endDate.setDate(this.endDate.getDate() + planDetails.duration);
  }
  next();
});

module.exports = mongoose.model('Subscription', subscriptionSchema);
