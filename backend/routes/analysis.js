const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const Analysis = require('../models/Analysis');
const { analyzeText, analyzeUrl, analyzeImage } = require('../utils/factCheck');

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

// Configure multer for image uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept common image formats
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// POST /analyze - Analyze text, URL, or image
router.post('/analyze', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const { text, url } = req.body;
    const imageFile = req.file;

    // Validate input
    const inputCount = [text, url, imageFile].filter(Boolean).length;
    if (inputCount === 0) {
      return res.status(400).json({ 
        error: 'Please provide either text, URL, or an image for analysis' 
      });
    }

    if (inputCount > 1) {
      return res.status(400).json({ 
        error: 'Please provide only one type of input: text, URL, or image' 
      });
    }

    let analysisResult;
    let inputType;
    let originalText;
    let extractedText;

    // Analyze based on input type
    if (text) {
      if (typeof text !== 'string' || text.trim().length === 0) {
        return res.status(400).json({ error: 'Text cannot be empty' });
      }

      if (text.length > 10000) {
        return res.status(400).json({ error: 'Text cannot exceed 10000 characters' });
      }

      inputType = 'text';
      originalText = text.trim();
      analysisResult = await analyzeText(originalText);
      
    } else if (url) {
      if (typeof url !== 'string' || url.trim().length === 0) {
        return res.status(400).json({ error: 'URL cannot be empty' });
      }

      inputType = 'url';
      originalText = url.trim();
      analysisResult = await analyzeUrl(originalText);
      extractedText = analysisResult.extractedText;
      
    } else if (imageFile) {
      inputType = 'image';
      originalText = imageFile.originalname;
      analysisResult = await analyzeImage(imageFile.buffer);
      extractedText = analysisResult.extractedText;
    }

    // Create analysis record
    const analysis = new Analysis({
      userId: req.userId,
      inputType,
      originalText,
      extractedText,
      verdict: analysisResult.verdict,
      confidence: analysisResult.confidence,
      explanation: analysisResult.explanation,
      cyberAlert: analysisResult.cyberAlert,
      sources: analysisResult.sources || [],
      processingTime: analysisResult.processingTime
    });

    await analysis.save();

    // Return result
    res.status(201).json({
      message: 'Analysis completed successfully',
      analysis: {
        id: analysis._id,
        inputType: analysis.inputType,
        verdict: analysis.verdict,
        confidence: analysis.confidence,
        explanation: analysis.explanation,
        cyberAlert: analysis.cyberAlert,
        sources: analysis.sources,
        extractedText: analysis.extractedText,
        processingTime: analysis.processingTime,
        createdAt: analysis.createdAt,
        isHighConfidence: analysis.isHighConfidence(),
        severity: analysis.getSeverity()
      }
    });

  } catch (error) {
    console.error('Analysis endpoint error:', error);
    
    // Handle multer errors
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Image file size cannot exceed 5MB' });
      }
      return res.status(400).json({ error: 'File upload error: ' + error.message });
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors 
      });
    }

    res.status(500).json({ 
      error: 'Internal server error during analysis' 
    });
  }
});

// GET /history - Get user's analysis history
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50); // Max 50 items
    const skip = (page - 1) * limit;

    // Optional filters
    const { verdict, inputType, startDate, endDate } = req.query;
    const filter = { userId: req.userId };

    if (verdict) {
      filter.verdict = verdict;
    }

    if (inputType) {
      filter.inputType = inputType;
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.createdAt.$lte = new Date(endDate);
      }
    }

    // Get analyses with pagination
    const analyses = await Analysis.find(filter)
      .select('inputType verdict confidence explanation cyberAlert sources createdAt processingTime')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Get total count for pagination
    const total = await Analysis.countDocuments(filter);

    // Format response
    const formattedAnalyses = analyses.map(analysis => ({
      id: analysis._id,
      inputType: analysis.inputType,
      verdict: analysis.verdict,
      confidence: analysis.confidence,
      explanation: analysis.explanation,
      cyberAlert: analysis.cyberAlert,
      sources: analysis.sources,
      createdAt: analysis.createdAt,
      processingTime: analysis.processingTime,
      isHighConfidence: analysis.confidence >= 70,
      severity: getSeverityFromVerdict(analysis.verdict)
    }));

    res.json({
      analyses: formattedAnalyses,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalAnalyses: total,
        hasMore: skip + analyses.length < total
      },
      stats: {
        totalAnalyses: total,
        averageConfidence: await calculateAverageConfidence(req.userId),
        verdictBreakdown: await getVerdictBreakdown(req.userId)
      }
    });

  } catch (error) {
    console.error('History endpoint error:', error);
    res.status(500).json({ error: 'Internal server error fetching history' });
  }
});

// GET /history/:id - Get specific analysis details
router.get('/history/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: 'Invalid analysis ID' });
    }

    const analysis = await Analysis.findOne({ 
      _id: id, 
      userId: req.userId 
    });

    if (!analysis) {
      return res.status(404).json({ error: 'Analysis not found' });
    }

    res.json({
      analysis: {
        id: analysis._id,
        inputType: analysis.inputType,
        originalText: analysis.originalText,
        extractedText: analysis.extractedText,
        verdict: analysis.verdict,
        confidence: analysis.confidence,
        explanation: analysis.explanation,
        cyberAlert: analysis.cyberAlert,
        sources: analysis.sources,
        createdAt: analysis.createdAt,
        processingTime: analysis.processingTime,
        isHighConfidence: analysis.isHighConfidence(),
        severity: analysis.getSeverity()
      }
    });

  } catch (error) {
    console.error('Get analysis error:', error);
    res.status(500).json({ error: 'Internal server error fetching analysis' });
  }
});

// DELETE /history/:id - Delete specific analysis
router.delete('/history/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: 'Invalid analysis ID' });
    }

    const result = await Analysis.deleteOne({ 
      _id: id, 
      userId: req.userId 
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Analysis not found' });
    }

    res.json({ message: 'Analysis deleted successfully' });

  } catch (error) {
    console.error('Delete analysis error:', error);
    res.status(500).json({ error: 'Internal server error deleting analysis' });
  }
});

// Helper functions
function getSeverityFromVerdict(verdict) {
  const severityMap = {
    'Fake': 'high',
    'Misleading': 'medium',
    'Uncertain': 'low',
    'Real': 'none'
  };
  return severityMap[verdict] || 'unknown';
}

async function calculateAverageConfidence(userId) {
  try {
    const result = await Analysis.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      { $group: { _id: null, avgConfidence: { $avg: '$confidence' } } }
    ]);
    return result.length > 0 ? Math.round(result[0].avgConfidence) : 0;
  } catch (error) {
    return 0;
  }
}

async function getVerdictBreakdown(userId) {
  try {
    const result = await Analysis.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      { $group: { _id: '$verdict', count: { $sum: 1 } } }
    ]);
    
    const breakdown = {
      Fake: 0,
      Real: 0,
      Misleading: 0,
      Uncertain: 0
    };
    
    result.forEach(item => {
      breakdown[item._id] = item.count;
    });
    
    return breakdown;
  } catch (error) {
    return { Fake: 0, Real: 0, Misleading: 0, Uncertain: 0 };
  }
}

module.exports = router;
