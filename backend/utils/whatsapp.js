const { analyzeText } = require('./factCheck');

/**
 * Handle incoming WhatsApp message from Twilio webhook
 * @param {string} incomingMessage - The message text from WhatsApp
 * @returns {Promise<string>} Formatted response message
 */
async function handleWhatsAppMessage(incomingMessage) {
    try {
        // Clean and validate the incoming message
        if (!incomingMessage || typeof incomingMessage !== 'string') {
            return getErrorMessage();
        }

        const cleanMessage = incomingMessage.trim();
        
        // Handle help commands
        if (cleanMessage.toLowerCase() === 'help' || cleanMessage.toLowerCase() === '/help') {
            return getHelpMessage();
        }

        if (cleanMessage.toLowerCase() === 'about' || cleanMessage.toLowerCase() === '/about') {
            return getAboutMessage();
        }

        // Check if message is too short
        if (cleanMessage.length < 10) {
            return getShortMessageError();
        }

        // Check if message is too long
        if (cleanMessage.length > 1000) {
            return getLongMessageError();
        }

        // Analyze the text
        const analysisResult = await analyzeText(cleanMessage);
        
        // Format the result for WhatsApp
        return formatWhatsAppResponse(analysisResult);

    } catch (error) {
        console.error('WhatsApp message handling error:', error);
        return getErrorMessage();
    }
}

/**
 * Format analysis result for WhatsApp with emojis and proper formatting
 * @param {Object} analysis - Analysis result from factCheck.js
 * @returns {string} Formatted WhatsApp message
 */
function formatWhatsAppResponse(analysis) {
    const { verdict, confidence, explanation, cyberAlert, sources, processingTime } = analysis;
    
    // Get verdict emoji and color
    const verdictEmoji = getVerdictEmoji(verdict);
    const confidenceEmoji = getConfidenceEmoji(confidence);
    
    // Build the response
    let response = '';
    
    // Header with verdict
    response += `${verdictEmoji} *Verdict: ${verdict}*\n\n`;
    
    // Confidence
    response += `${confidenceEmoji} *Confidence: ${confidence}%*\n\n`;
    
    // Explanation (truncate if too long for WhatsApp)
    const truncatedExplanation = explanation.length > 500 ? 
        explanation.substring(0, 500) + '...' : explanation;
    response += `*Analysis:*\n${truncatedExplanation}\n\n`;
    
    // Cyber alert if present
    if (cyberAlert) {
        response += `! *Cyber Alert*\n${cyberAlert}\n\n`;
    }
    
    // Sources if available
    if (sources && sources.length > 0) {
        response += `*Sources:*\n`;
        sources.slice(0, 2).forEach((source, index) => {
            response += `${index + 1}. ${source}\n`;
        });
        if (sources.length > 2) {
            response += `... and ${sources.length - 2} more\n`;
        }
        response += '\n';
    }
    
    // Footer with processing info
    response += `*Processing Time:* ${processingTime}ms\n`;
    response += `*Powered by Sachet* - Your trusted fact-checking companion\n\n`;
    
    // Add disclaimer
    response += `*Disclaimer:* This analysis is for informational purposes only. Always verify information from multiple sources.`;
    
    return response;
}

/**
 * Get emoji based on verdict
 * @param {string} verdict - The verdict (Fake, Real, Misleading, Uncertain)
 * @returns {string} Corresponding emoji
 */
function getVerdictEmoji(verdict) {
    const verdictEmojis = {
        'Fake': 'fake news',
        'Real': 'real news',
        'Misleading': 'misleading',
        'Uncertain': 'uncertain'
    };
    
    switch (verdict) {
        case 'Fake':
            return 'fake news';
        case 'Real':
            return 'real news';
        case 'Misleading':
            return 'misleading';
        case 'Uncertain':
            return 'uncertain';
        default:
            return 'question';
    }
}

/**
 * Get emoji based on confidence level
 * @param {number} confidence - Confidence percentage (0-100)
 * @returns {string} Confidence emoji
 */
function getConfidenceEmoji(confidence) {
    if (confidence >= 80) {
        return 'high confidence';
    } else if (confidence >= 60) {
        return 'medium confidence';
    } else if (confidence >= 40) {
        return 'low confidence';
    } else {
        return 'very low confidence';
    }
}

/**
 * Get help message for WhatsApp
 * @returns {string} Help message
 */
function getHelpMessage() {
    return `*Sachet WhatsApp Bot - Help* 

*Commands:*
help - Show this help message
about - Learn about Sachet

*How to use:*
Simply send any text, news article, or claim you want to fact-check, and I'll analyze it for you!

*What I check:*
fake news detection
source credibility
content accuracy
potential misinformation

*Example:*
"Breaking: Scientists discover that eating chocolate makes you fly!"

*Note:* Messages should be between 10-1000 characters for best results.

*Powered by Sachet* - Your trusted fact-checking companion`;
}

/**
 * Get about message for WhatsApp
 * @returns {string} About message
 */
function getAboutMessage() {
    return `*About Sachet* 

Sachet is your trusted AI-powered fact-checking companion designed to help you identify fake news, misinformation, and false information.

*What we do:*
Analyze text for authenticity
Check source credibility
Provide confidence scores
Offer cyber security alerts

*Our mission:*
To promote media literacy and help people make informed decisions in the digital age.

*Features:*
Real-time analysis
Multiple source verification
Cyber awareness tips
Multi-platform support

*Learn more:* Visit our website or download our mobile app for more features!

*Powered by AI* - Building a more informed society`;
}

/**
 * Get error message for invalid input
 * @returns {string} Error message
 */
function getErrorMessage() {
    return `Oops! Something went wrong while analyzing your message. 

Please try again with a different text or contact support if the issue persists.

*Powered by Sachet* - Your trusted fact-checking companion`;
}

/**
 * Get error message for short input
 * @returns {string} Error message
 */
function getShortMessageError() {
    return `*Message too short!*

Please send at least 10 characters for analysis. Longer messages provide better context for accurate fact-checking.

*Example:* Send a full news headline or article excerpt instead of just a few words.

*Powered by Sachet* - Your trusted fact-checking companion`;
}

/**
 * Get error message for long input
 * @returns {string} Error message
 */
function getLongMessageError() {
    return `*Message too long!*

Please send messages under 1000 characters for optimal analysis. For longer articles, consider breaking them into smaller chunks or sharing the key points.

*Tip:* Focus on the main claim or headline you want to fact-check.

*Powered by Sachet* - Your trusted fact-checking companion`;
}

/**
 * Validate WhatsApp message
 * @param {string} message - Message to validate
 * @returns {Object} Validation result
 */
function validateWhatsAppMessage(message) {
    if (!message || typeof message !== 'string') {
        return { valid: false, error: 'Invalid message format' };
    }

    const cleanMessage = message.trim();
    
    if (cleanMessage.length === 0) {
        return { valid: false, error: 'Empty message' };
    }

    if (cleanMessage.length < 10) {
        return { valid: false, error: 'Message too short (min 10 characters)' };
    }

    if (cleanMessage.length > 1000) {
        return { valid: false, error: 'Message too long (max 1000 characters)' };
    }

    return { valid: true };
}

/**
 * Get message statistics
 * @param {string} message - Message to analyze
 * @returns {Object} Message statistics
 */
function getMessageStats(message) {
    return {
        length: message.length,
        wordCount: message.split(/\s+/).length,
        characterCount: message.length,
        hasNumbers: /\d/.test(message),
        hasUrl: /https?:\/\/|www\./i.test(message),
        hasEmail: /\S+@\S+\.\S+/.test(message)
    };
}

module.exports = {
    handleWhatsAppMessage,
    validateWhatsAppMessage,
    getMessageStats,
    formatWhatsAppResponse
};
