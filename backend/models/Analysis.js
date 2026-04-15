const mongoose = require('mongoose');

const analysisSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },
  inputType: {
    type: String,
    enum: ['text', 'url', 'image'],
    required: [true, 'Input type is required']
  },
  originalText: {
    type: String,
    required: function() {
      return this.inputType === 'text';
    },
    maxlength: [10000, 'Original text cannot exceed 10000 characters']
  },
  extractedText: {
    type: String,
    maxlength: [10000, 'Extracted text cannot exceed 10000 characters']
  },
  verdict: {
    type: String,
    enum: ['Fake', 'Real', 'Misleading', 'Uncertain'],
    required: [true, 'Verdict is required']
  },
  confidence: {
    type: Number,
    min: 0,
    max: 100,
    required: [true, 'Confidence is required'],
    validate: {
      validator: function(value) {
        return value >= 0 && value <= 100;
      },
      message: 'Confidence must be between 0 and 100'
    }
  },
  explanation: {
    type: String,
    required: [true, 'Explanation is required'],
    maxlength: [2000, 'Explanation cannot exceed 2000 characters']
  },
  cyberAlert: {
    type: String,
    maxlength: [500, 'Cyber alert cannot exceed 500 characters']
  },
  sources: [{
    type: String,
    maxlength: [500, 'Source URL cannot exceed 500 characters']
  }],
  processingTime: {
    type: Number, // in milliseconds
    required: true
  }
}, {
  timestamps: true
});

// Index for efficient queries
analysisSchema.index({ userId: 1, createdAt: -1 });
analysisSchema.index({ verdict: 1 });
analysisSchema.index({ confidence: -1 });

// Method to check if analysis is high confidence
analysisSchema.methods.isHighConfidence = function() {
  return this.confidence >= 70;
};

// Method to get verdict severity
analysisSchema.methods.getSeverity = function() {
  const severityMap = {
    'Fake': 'high',
    'Misleading': 'medium',
    'Uncertain': 'low',
    'Real': 'none'
  };
  return severityMap[this.verdict] || 'unknown';
};

module.exports = mongoose.model('Analysis', analysisSchema);
