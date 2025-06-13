const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ بيانات OpenRouter
const API_URL = "https://openrouter.ai/api/v1/chat/completions";
const API_KEY = "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";
const MODEL = "google/gemma-3n-e4b-it:free";

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Debug middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    if (req.body && Object.keys(req.body).length > 0) {
        console.log('Request Body:', JSON.stringify(req.body, null, 2));
    }
    next();
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server Error:', err);
    res.status(500).json({
        error: {
            message: 'Internal Server Error',
            details: err.message,
            timestamp: new Date().toISOString()
        }
    });
});

function generatePrompt(startDate, endDate, destination, preferences) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    
    return `Create a detailed ${days}-day travel itinerary for ${destination}. 
    The trip starts on ${startDate} and ends on ${endDate}.
    Travel preferences: ${preferences.join(', ')}.
    
    Please provide a day-by-day itinerary with:
    1. 3-4 activities per day
    2. Brief descriptions for each activity
    3. Consider the preferences mentioned
    4. Make it realistic and practical
    
    Format the response as a JSON array of days, where each day has:
    - day: number
    - activities: array of {title: string, description: string}
    
    Example format:
    [
        {
            "day": 1,
            "activities": [
                {
                    "title": "Morning Activity",
                    "description": "Description here"
                }
            ]
        }
    ]`;
}

app.post("/generate-itinerary", async (req, res) => {
    const startTime = Date.now();
    const requestId = Math.random().toString(36).substring(7);
    
    console.log(`[${requestId}] Starting itinerary generation`);
    
    try {
        const { startDate, endDate, destination, preferences } = req.body;
        
        // Input validation
        if (!startDate || !endDate || !destination) {
            throw new Error('Missing required fields: startDate, endDate, and destination are required');
        }

        if (new Date(startDate) > new Date(endDate)) {
            throw new Error('Start date cannot be after end date');
        }

        if (!Array.isArray(preferences)) {
            throw new Error('Preferences must be an array');
        }

        console.log(`[${requestId}] Generating itinerary for ${destination}`);

        const prompt = generatePrompt(startDate, endDate, destination, preferences);
        
        const response = await axios.post(
            API_URL,
            {
                model: MODEL,
                messages: [{ role: "user", content: prompt }]
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${API_KEY}`,
                    "HTTP-Referer": "http://localhost:3000",
                    "X-Title": "ai-travel-planner"
                }
            }
        );

        const processingTime = Date.now() - startTime;
        console.log(`[${requestId}] Itinerary generated in ${processingTime}ms`);

        // Parse the AI response to get the itinerary
        const reply = response.data.choices[0].message.content;
        let itinerary;
        try {
            // Extract JSON from the response
            const jsonMatch = reply.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                itinerary = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('Invalid response format');
            }
        } catch (error) {
            console.error(`[${requestId}] Error parsing itinerary:`, error);
            throw new Error('Failed to parse AI response');
        }

        res.json({ 
            itinerary,
            debug: {
                requestId,
                processingTime,
                model: MODEL,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        const errorTime = Date.now() - startTime;
        console.error(`[${requestId}] Error after ${errorTime}ms:`, error.response?.data || error.message);
        
        // Extract meaningful error message
        let errorMessage = 'Failed to generate itinerary';
        if (error.response?.data?.error?.message) {
            errorMessage = error.response.data.error.message;
        } else if (error.response?.data?.error) {
            errorMessage = error.response.data.error;
        } else if (error.message) {
            errorMessage = error.message;
        }
        
        res.status(500).json({ 
            error: {
                message: errorMessage,
                details: error.response?.data || error.stack,
                requestId,
                processingTime: errorTime,
                timestamp: new Date().toISOString()
            }
        });
    }
});

// Health check endpoint
app.get("/health", (req, res) => {
    res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

app.listen(PORT, () => {
    console.log(`✅ Server running at http://localhost:${PORT}`);
    console.log(`📝 API Documentation:`);
    console.log(`   POST /generate-itinerary - Generate travel itinerary`);
    console.log(`   GET /health - Check server health`);
});
