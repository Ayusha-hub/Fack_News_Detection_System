# Twilio WhatsApp Setup Guide

This guide will help you set up Twilio WhatsApp integration for the Sachet fact-checking bot.

## Prerequisites

- Node.js backend deployed and running
- Twilio account (free trial is sufficient for testing)
- WhatsApp-enabled Twilio phone number

## Step 1: Create Twilio Account

1. Sign up for a free Twilio account at [https://www.twilio.com](https://www.twilio.com)
2. Verify your email address and phone number
3. Complete the account verification process

## Step 2: Get WhatsApp Sandbox Number

1. Go to Twilio Console > Messaging > Try it out > Send a WhatsApp message
2. Click "Get Started" with the WhatsApp Sandbox
3. Follow the instructions to connect your WhatsApp number to the sandbox
4. Save the sandbox phone number (starts with `whatsapp:+14155238886`)

## Step 3: Configure Environment Variables

Add the following to your `.env` file:

```bash
# Twilio Configuration
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
```

You can find your Account SID and Auth Token in the Twilio Console dashboard.

## Step 4: Deploy Your Backend

Make sure your backend is deployed and accessible from the internet. You'll need:

- A public URL (e.g., `https://your-app.herokuapp.com`)
- SSL certificate (HTTPS is required for WhatsApp webhooks)

## Step 5: Configure WhatsApp Webhook

1. In Twilio Console, go to Messaging > Senders > WhatsApp Senders
2. Click on your sandbox number
3. Under "Webhook URL", enter your deployed backend URL:
   ```
   https://your-app.herokuapp.com/whatsapp-webhook
   ```
4. Set the webhook method to `HTTP POST`
5. Click "Save"

## Step 6: Test the Integration

1. Send a WhatsApp message to the sandbox number
2. Try these test messages:
   - `help` - Should show help information
   - `about` - Should show about information
   - Any news text (10-1000 characters) - Should return fact-check analysis

Example test message:
```
Breaking: Scientists discover that eating chocolate makes you fly! This revolutionary breakthrough was announced by researchers at the fictional University of Amazing Things.
```

## Step 7: Move to Production (Optional)

For production use:

1. Upgrade from sandbox to a dedicated WhatsApp Business Profile
2. Apply for WhatsApp Business API access
3. Use a real Twilio phone number instead of sandbox
4. Update your webhook URL to the production endpoint

## Webhook URL Format

The webhook URL should be:
```
https://your-domain.com/whatsapp-webhook
```

Make sure to replace `your-domain.com` with your actual deployed backend URL.

## Testing Locally with Ngrok

For local testing, you can use ngrok:

1. Install ngrok: `npm install -g ngrok`
2. Run your backend locally (e.g., on port 5000)
3. Start ngrok: `ngrok http 5000`
4. Use the ngrok URL in your Twilio webhook configuration

## Troubleshooting

### Common Issues:

1. **Webhook not responding**
   - Check if your backend is running
   - Verify the webhook URL is correct
   - Check server logs for errors

2. **Invalid signature error**
   - Ensure your Twilio Auth Token is correct
   - Check if the webhook URL includes the full path

3. **No response from bot**
   - Check if the fact-checking APIs are configured
   - Verify environment variables are set correctly
   - Check server logs for API errors

### Debug Endpoints:

- `GET /whatsapp-webhook/status` - Check webhook status
- Check server logs for incoming messages

## Security Considerations

- Always validate webhook signatures in production
- Use HTTPS for webhook URLs
- Keep your Twilio credentials secure
- Monitor API usage to avoid unexpected charges

## Rate Limits

- Twilio WhatsApp has rate limits (1 message per second per conversation)
- Consider implementing rate limiting in your application
- Cache responses for common queries to reduce API calls

## Example Environment File

```bash
# Server Configuration
PORT=5000
NODE_ENV=production
FRONTEND_URL=https://your-frontend.com

# Database
MONGODB_URI=mongodb://localhost:27017/sachet_db

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_here_make_it_long_and_random

# Twilio WhatsApp
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886

# Analysis Service APIs
GOOGLE_FACT_CHECK_API_KEY=your_google_fact_check_api_key
HUGGINGFACE_API_KEY=your_huggingface_api_key
OCR_SPACE_API_KEY=your_ocr_space_api_key
```

## Support

If you encounter issues:

1. Check Twilio's WhatsApp documentation
2. Review server logs for detailed error messages
3. Test with the Twilio API Explorer
4. Ensure all environment variables are correctly set

## Next Steps

Once your WhatsApp bot is working:

1. Add more sophisticated response formatting
2. Implement user tracking and personalization
3. Add support for image analysis via WhatsApp
4. Set up analytics and monitoring
5. Consider adding support for multiple languages

Your Sachet WhatsApp bot is now ready to help users fact-check information directly through WhatsApp!
