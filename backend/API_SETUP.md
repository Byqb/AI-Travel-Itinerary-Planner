# API Setup Guide

This guide will help you set up the required API keys for the AI Travel Planner to work properly.

## Required API Keys

### 1. OpenRouter API Key (Primary AI Service)

- **Purpose**: Generate AI-powered travel itineraries
- **Get it from**: https://openrouter.ai/keys
- **Cost**: Free tier available
- **Setup**:
  1. Sign up at OpenRouter
  2. Create an API key
  3. Add to your environment variables

### 2. Hugging Face Token (Alternative AI Service)

- **Purpose**: Alternative AI service for itinerary generation
- **Get it from**: https://huggingface.co/settings/tokens
- **Cost**: Free tier available
- **Setup**:
  1. Create account on Hugging Face
  2. Generate access token
  3. Add to your environment variables

### 3. OpenWeatherMap API Key

- **Purpose**: Weather forecasts for destinations
- **Get it from**: https://openweathermap.org/api
- **Cost**: Free tier available (1000 calls/day)
- **Setup**:
  1. Sign up at OpenWeatherMap
  2. Get your API key
  3. Add to your environment variables

### 4. ExchangeRate API Key

- **Purpose**: Currency conversion for budget planning
- **Get it from**: https://exchangerate-api.com/
- **Cost**: Free tier available
- **Setup**:
  1. Sign up at ExchangeRate API
  2. Get your API key
  3. Add to your environment variables

### 5. Unsplash API Key

- **Purpose**: Destination photos and images
- **Get it from**: https://unsplash.com/developers
- **Cost**: Free tier available
- **Setup**:
  1. Create developer account on Unsplash
  2. Create an application
  3. Get your API key
  4. Add to your environment variables

## Environment Variables Setup

Create a `.env` file in the `backend` directory with the following content:

```env
# AI Services
OPENROUTER_API_KEY=your_openrouter_api_key_here
HF_TOKEN=your_huggingface_token_here

# External Services
WEATHER_API_KEY=your_openweathermap_api_key_here
CURRENCY_API_KEY=your_exchangerate_api_key_here
UNSPLASH_API_KEY=your_unsplash_api_key_here

# Server Configuration
PORT=3000
NODE_ENV=development
```

## Fallback System

If no API keys are configured or if the AI services fail, the application will automatically use pre-built sample itineraries for popular destinations like:

- Paris, France
- Tokyo, Japan
- New York, USA

For other destinations, it will generate a generic itinerary structure.

## Testing the Setup

1. Start the server: `npm start`
2. Open the application in your browser
3. Try generating an itinerary
4. Check the console logs for API status messages

## Troubleshooting

### "Failed to connect to AI service" Error

- Check if your API keys are correctly set in the `.env` file
- Verify that your API keys are valid and not expired
- Check your internet connection
- The app will use fallback itineraries if AI services fail

### Weather Data Not Loading

- Verify your OpenWeatherMap API key
- Check if you've exceeded the free tier limits

### Photos Not Loading

- Verify your Unsplash API key
- Check if you've exceeded the free tier limits

## Security Notes

- Never commit your `.env` file to version control
- Keep your API keys secure and don't share them publicly
- Consider using environment variables in production deployments
- Monitor your API usage to avoid unexpected charges
