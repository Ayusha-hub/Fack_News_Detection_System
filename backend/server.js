require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const twilio = require('twilio');

// Import routes and utilities
const authRoutes = require('./routes/auth');
const analysisRoutes = require('./routes/analysis');
const paymentRoutes = require('./routes/payment');
const adminRoutes = require('./routes/admin');
const { handleWhatsAppMessage } = require('./utils/whatsapp');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/analysis', analysisRoutes);
//app.use('/api/payment', paymentRoutes);
app.use('/api/admin', adminRoutes);

// WhatsApp Webhook for Twilio
app.post('/whatsapp-webhook', express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const twilioSignature = req.headers['x-twilio-signature'];
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    
    // Verify webhook signature (optional but recommended)
    if (process.env.TWILIO_AUTH_TOKEN) {
      const requestIsValid = twilio.validateRequest(
        process.env.TWILIO_AUTH_TOKEN,
        twilioSignature,
        url,
        req.body
      );
      
      if (!requestIsValid) {
        console.error('Invalid Twilio signature');
        return res.status(403).send('Invalid signature');
      }
    }

    const incomingMsg = req.body.Body;
    const from = req.body.From;
    const to = req.body.To;
    
    console.log(`WhatsApp message from ${from}: ${incomingMsg}`);
    
    // Handle the incoming message
    const response = await handleWhatsAppMessage(incomingMsg);
    
    // Create TwiML response
    const twiml = `
      <Response>
        <Message>
          ${response}
        </Message>
      </Response>
    `;
    
    res.set('Content-Type', 'text/xml');
    res.send(twiml);
    
  } catch (error) {
    console.error('WhatsApp webhook error:', error);
    
    // Send error response
    const errorResponse = `
      <Response>
        <Message>
          Sorry, I encountered an error while processing your message. Please try again later.
        </Message>
      </Response>
    `;
    
    res.set('Content-Type', 'text/xml');
    res.send(errorResponse);
  }
});

// Webhook status endpoint for debugging
app.get('/whatsapp-webhook/status', (req, res) => {
  res.status(200).json({
    status: 'WhatsApp webhook is active',
    twilioConfigured: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({ 
      error: 'Validation failed', 
      details: errors 
    });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(409).json({ 
      error: `${field} already exists` 
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'Invalid token' });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Token expired' });
  }

  // Default error
  res.status(err.status || 500).json({ 
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Database connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB successfully');
    
    // Start server
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
    });
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  });

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  mongoose.connection.close(() => {
    console.log('MongoDB connection closed');
    process.exit(0);
  });
});

module.exports = app;
