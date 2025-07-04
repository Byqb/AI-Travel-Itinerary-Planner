# AI Travel Planner - Setup Guide

## Quick Fix for "Failed to connect to AI service" Error

The app now includes a **demo mode** that will work even without API keys. If you're getting the "Failed to connect to AI service" error, the app will automatically fall back to demo mode and generate sample itineraries.

## API Key Configuration (Optional)

To use real AI services, you can configure API keys:

### 1. Create a `.env` file in the backend directory:

```bash
# AI Service API Keys
OPENROUTER_API_KEY=your_openrouter_api_key_here
HF_TOKEN=your_huggingface_token_here

# External Service API Keys
WEATHER_API_KEY=your_openweathermap_api_key_here
CURRENCY_API_KEY=your_exchangerate_api_key_here
UNSPLASH_API_KEY=your_unsplash_api_key_here

# Demo Mode (set to 'true' to force demo mode)
DEMO_MODE=false

# App URL
APP_URL=http://localhost:3000
```

### 2. Get API Keys:

- **OpenRouter API**: https://openrouter.ai/keys (Free tier available)
- **Hugging Face**: https://huggingface.co/settings/tokens (Free tier available)
- **OpenWeatherMap**: https://openweathermap.org/api (Free tier available)
- **ExchangeRate**: https://exchangerate-api.com/ (Free tier available)
- **Unsplash**: https://unsplash.com/developers (Free tier available)

### 3. Restart the server after adding the `.env` file:

```bash
npm start
```

## Demo Mode

The app now includes a robust demo mode that:

- ✅ Generates realistic travel itineraries
- ✅ Provides AI assistant responses
- ✅ Works without any API keys
- ✅ Automatically activates when AI services fail
- ✅ Supports both English and Arabic

## Troubleshooting

### If you still get errors:

1. **Check the console logs** - The server will show which mode it's running in
2. **Verify API keys** - Make sure they're valid and have sufficient credits
3. **Network issues** - Check your internet connection
4. **Rate limits** - Some free API tiers have usage limits

### Force Demo Mode:

Set `DEMO_MODE=true` in your `.env` file to always use demo mode.

## Features Available in Demo Mode

- ✅ Travel itinerary generation
- ✅ AI travel assistant
- ✅ Weather forecasts (mock data)
- ✅ Budget estimation
- ✅ Packing lists
- ✅ Travel tips
- ✅ Photo galleries (mock data)
- ✅ Itinerary sharing

The demo mode provides a fully functional experience for testing and demonstration purposes.
