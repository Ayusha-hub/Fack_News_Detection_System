const axios = require('axios');
const cheerio = require('cheerio');

// Google Fact Check API
const GOOGLE_FACT_CHECK_API_KEY = process.env.GOOGLE_FACT_CHECK_API_KEY;
const GOOGLE_FACT_CHECK_URL = 'https://factchecktools.googleapis.com/v1alpha1/claims:search';

// Hugging Face Inference API
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;
const HUGGINGFACE_MODEL = 'facebook/bart-large-mnli';
const HUGGINGFACE_URL = `https://api-inference.huggingface.co/models/${HUGGINGFACE_MODEL}`;

// OCR.space API
const OCR_SPACE_API_KEY = process.env.OCR_SPACE_API_KEY;
const OCR_SPACE_URL = 'https://api.ocr.space/parse/image';

/**
 * Analyze text using Google Fact Check API and Hugging Face
 * @param {string} text - Text to analyze
 * @returns {Object} Analysis result
 */
async function analyzeText(text) {
  const startTime = Date.now();
  
  try {
    // Clean and validate input
    if (!text || typeof text !== 'string') {
      throw new Error('Valid text is required for analysis');
    }

    const cleanText = text.trim().substring(0, 1000); // Limit to 1000 chars
    
    // Try Google Fact Check API first for longer texts
    let googleResult = null;
    if (cleanText.length > 20 && GOOGLE_FACT_CHECK_API_KEY) {
      googleResult = await callGoogleFactCheck(cleanText);
    }

    // If Google API returns results, use them
    if (googleResult && googleResult.claims && googleResult.claims.length > 0) {
      const result = processGoogleResult(googleResult);
      result.processingTime = Date.now() - startTime;
      return result;
    }

    // Fallback to Hugging Face
    const huggingFaceResult = await callHuggingFace(cleanText);
    huggingFaceResult.processingTime = Date.now() - startTime;
    return huggingFaceResult;

  } catch (error) {
    console.error('Text analysis error:', error);
    
    // Return uncertain result on error
    return {
      verdict: 'Uncertain',
      confidence: 30,
      explanation: 'Unable to analyze text due to technical issues. Please try again later.',
      sources: [],
      cyberAlert: null,
      processingTime: Date.now() - startTime
    };
  }
}

/**
 * Call Google Fact Check API
 */
async function callGoogleFactCheck(text) {
  try {
    const response = await axios.get(GOOGLE_FACT_CHECK_URL, {
      params: {
        key: GOOGLE_FACT_CHECK_API_KEY,
        query: text,
        pageSize: 5,
        languageCode: 'en'
      },
      timeout: 10000
    });
    return response.data;
  } catch (error) {
    console.error('Google Fact Check API error:', error.message);
    return null;
  }
}

/**
 * Process Google Fact Check results
 */
function processGoogleResult(data) {
  const claims = data.claims || [];
  
  if (claims.length === 0) {
    return {
      verdict: 'Uncertain',
      confidence: 40,
      explanation: 'No fact-check results found for this content.',
      sources: [],
      cyberAlert: null
    };
  }

  // Analyze the first claim (most relevant)
  const claim = claims[0];
  const textualRating = claim.claimReview?.[0]?.textualRating || '';
  const title = claim.claimReview?.[0]?.title || '';
  const url = claim.claimReview?.[0]?.url || '';

  // Determine verdict based on rating
  let verdict = 'Uncertain';
  let confidence = 50;
  let cyberAlert = null;

  const rating = textualRating.toLowerCase();
  if (rating.includes('false') || rating.includes('fake') || rating.includes('incorrect')) {
    verdict = 'Fake';
    confidence = 80;
    cyberAlert = 'This content has been flagged as potentially false information.';
  } else if (rating.includes('true') || rating.includes('accurate') || rating.includes('correct')) {
    verdict = 'Real';
    confidence = 80;
  } else if (rating.includes('misleading') || rating.includes('partially') || rating.includes('mixed')) {
    verdict = 'Misleading';
    confidence = 65;
    cyberAlert = 'This content contains partially accurate but misleading information.';
  }

  return {
    verdict,
    confidence,
    explanation: title || `Fact check rating: ${textualRating}`,
    sources: url ? [url] : [],
    cyberAlert
  };
}

/**
 * Call Hugging Face Inference API
 */
async function callHuggingFace(text) {
  try {
    const candidateLabels = ['fake news', 'real news', 'misleading', 'unverified'];
    
    const response = await axios.post(HUGGINGFACE_URL, {
      inputs: text,
      parameters: {
        candidate_labels: candidateLabels
      }
    }, {
      headers: {
        'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    const result = response.data;
    return processHuggingFaceResult(result);
    
  } catch (error) {
    console.error('Hugging Face API error:', error.message);
    
    // Return uncertain result if API fails
    return {
      verdict: 'Uncertain',
      confidence: 30,
      explanation: 'Unable to verify content using available fact-checking services.',
      sources: [],
      cyberAlert: null
    };
  }
}

/**
 * Process Hugging Face results
 */
function processHuggingFaceResult(data) {
  if (!data || !data.labels || !data.scores) {
    return {
      verdict: 'Uncertain',
      confidence: 30,
      explanation: 'Unable to analyze content reliability.',
      sources: [],
      cyberAlert: null
    };
  }

  // Find the label with highest score
  const maxIndex = data.scores.indexOf(Math.max(...data.scores));
  const topLabel = data.labels[maxIndex];
  const confidence = Math.round(data.scores[maxIndex] * 100);

  // Map labels to verdicts
  let verdict = 'Uncertain';
  let cyberAlert = null;

  if (topLabel === 'fake news') {
    verdict = 'Fake';
    cyberAlert = 'This content appears to contain false information.';
  } else if (topLabel === 'real news') {
    verdict = 'Real';
  } else if (topLabel === 'misleading') {
    verdict = 'Misleading';
    cyberAlert = 'This content may be misleading or partially inaccurate.';
  } else {
    verdict = 'Uncertain';
  }

  return {
    verdict,
    confidence,
    explanation: `Content analysis indicates this is likely ${topLabel} with ${confidence}% confidence.`,
    sources: [],
    cyberAlert
  };
}

/**
 * Analyze URL by extracting content and then analyzing text
 * @param {string} url - URL to analyze
 * @returns {Object} Analysis result
 */
async function analyzeUrl(url) {
  const startTime = Date.now();
  
  try {
    // Validate URL
    if (!url || typeof url !== 'string') {
      throw new Error('Valid URL is required');
    }

    const urlObj = new URL(url);
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      throw new Error('URL must use HTTP or HTTPS protocol');
    }

    // Extract article content
    const extractedText = await extractArticleContent(url);
    
    if (!extractedText || extractedText.length < 50) {
      throw new Error('Unable to extract sufficient content from the URL');
    }

    // Analyze the extracted text
    const analysisResult = await analyzeText(extractedText);
    analysisResult.processingTime = Date.now() - startTime;
    
    return {
      ...analysisResult,
      extractedText: extractedText.substring(0, 1000) // Limit stored text
    };

  } catch (error) {
    console.error('URL analysis error:', error);
    return {
      verdict: 'Uncertain',
      confidence: 30,
      explanation: `Failed to analyze URL: ${error.message}`,
      sources: [],
      cyberAlert: null,
      processingTime: Date.now() - startTime,
      extractedText: null
    };
  }
}

/**
 * Extract article content from URL
 */
async function extractArticleContent(url) {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000,
      maxRedirects: 3
    });

    const $ = cheerio.load(response.data);
    
    // Remove unwanted elements
    $('script, style, nav, header, footer, aside, .ad, .advertisement').remove();
    
    // Try to find main content
    let content = '';
    
    // Common selectors for article content
    const contentSelectors = [
      'article',
      '.article-content',
      '.post-content',
      '.entry-content',
      '.content',
      'main',
      '.story-body',
      '.article-body'
    ];
    
    for (const selector of contentSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        content = element.text().trim();
        if (content.length > 200) break;
      }
    }
    
    // Fallback to body if no content found
    if (!content || content.length < 200) {
      content = $('body').text().trim();
    }
    
    // Clean up text
    content = content
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, ' ')
      .trim()
      .substring(0, 2000); // Limit to 2000 chars
    
    return content;

  } catch (error) {
    console.error('Content extraction error:', error.message);
    throw new Error('Failed to extract content from URL');
  }
}

/**
 * Analyze image by extracting text using OCR and then analyzing text
 * @param {Buffer} imageBuffer - Image buffer
 * @returns {Object} Analysis result
 */
async function analyzeImage(imageBuffer) {
  const startTime = Date.now();
  
  try {
    if (!imageBuffer || !Buffer.isBuffer(imageBuffer)) {
      throw new Error('Valid image buffer is required');
    }

    // Extract text using OCR
    const extractedText = await extractTextFromImage(imageBuffer);
    
    if (!extractedText || extractedText.trim().length < 10) {
      return {
        verdict: 'Uncertain',
        confidence: 20,
        explanation: 'No readable text found in the image or text is too short for analysis.',
        sources: [],
        cyberAlert: null,
        processingTime: Date.now() - startTime,
        extractedText: extractedText || ''
      };
    }

    // Analyze the extracted text
    const analysisResult = await analyzeText(extractedText);
    analysisResult.processingTime = Date.now() - startTime;
    
    return {
      ...analysisResult,
      extractedText: extractedText.substring(0, 1000) // Limit stored text
    };

  } catch (error) {
    console.error('Image analysis error:', error);
    return {
      verdict: 'Uncertain',
      confidence: 30,
      explanation: `Failed to analyze image: ${error.message}`,
      sources: [],
      cyberAlert: null,
      processingTime: Date.now() - startTime,
      extractedText: null
    };
  }
}

/**
 * Extract text from image using OCR.space
 */
async function extractTextFromImage(imageBuffer) {
  try {
    if (!OCR_SPACE_API_KEY) {
      throw new Error('OCR.space API key is required');
    }

    const formData = new FormData();
    formData.append('file', new Blob([imageBuffer]), 'image.jpg');
    formData.append('language', 'eng');
    formData.append('isOverlayRequired', 'false');
    formData.append('detectOrientation', 'true');
    formData.append('scale', 'true');
    formData.append('OCREngine', '2');

    const response = await axios.post(OCR_SPACE_URL, formData, {
      headers: {
        'apikey': OCR_SPACE_API_KEY
      },
      timeout: 30000
    });

    const result = response.data;
    
    if (result.IsErroredOnProcessing) {
      throw new Error(result.ErrorMessage || 'OCR processing failed');
    }

    if (!result.ParsedResults || result.ParsedResults.length === 0) {
      return '';
    }

    return result.ParsedResults[0].ParsedText || '';

  } catch (error) {
    console.error('OCR extraction error:', error.message);
    throw new Error('Failed to extract text from image');
  }
}

module.exports = {
  analyzeText,
  analyzeUrl,
  analyzeImage
};
