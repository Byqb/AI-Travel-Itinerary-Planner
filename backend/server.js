const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ بيانات OpenRouter
const API_URL = "https://openrouter.ai/api/v1/chat/completions";
const API_KEY = "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";
const MODEL = "deepseek/deepseek-r1-0528:free";

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

function generatePrompt(startDate, endDate, destination, preferences, language) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    
    const isArabic = language === 'ar';
    
    return `${isArabic ? 'إنشاء' : 'Create'} a detailed ${days}-day travel itinerary for ${destination}. 
    ${isArabic ? 'تبدأ الرحلة في' : 'The trip starts on'} ${startDate} ${isArabic ? 'وتنتهي في' : 'and ends on'} ${endDate}.
    ${isArabic ? 'الاهتمامات:' : 'Travel preferences:'} ${preferences.join(', ')}.
    
    ${isArabic ? 'يرجى تقديم خطة يومية تتضمن:' : 'Please provide a day-by-day itinerary with:'}
    1. ${isArabic ? '3-4 نشاطات في اليوم' : '3-4 activities per day'}
    2. ${isArabic ? 'وصف مختصر لكل نشاط' : 'Brief descriptions for each activity'}
    3. ${isArabic ? 'مراعاة الاهتمامات المذكورة' : 'Consider the preferences mentioned'}
    4. ${isArabic ? 'جعلها واقعية وعملية' : 'Make it realistic and practical'}
    
    ${isArabic ? 'قم بتنسيق الرد كمصفوفة JSON من الأيام، حيث يحتوي كل يوم على:' : 'Format the response as a JSON array of days, where each day has:'}
    - day: number
    - activities: array of {title: string, description: string}
    
    ${isArabic ? 'مثال على التنسيق:' : 'Example format:'}
    [
        {
            "day": 1,
            "activities": [
                {
                    "title": "${isArabic ? 'نشاط الصباح' : 'Morning Activity'}",
                    "description": "${isArabic ? 'الوصف هنا' : 'Description here'}"
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
        const { startDate, endDate, destination, preferences, language } = req.body;
        console.log(`[${requestId}] Generating itinerary for ${destination} in ${language}`);

        const prompt = generatePrompt(startDate, endDate, destination, preferences, language);
        
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
                throw new Error(language === 'ar' ? 'تنسيق الاستجابة غير صالح' : 'Invalid response format');
            }
        } catch (error) {
            console.error(`[${requestId}] Error parsing itinerary:`, error);
            throw new Error(language === 'ar' ? 'فشل في تحليل استجابة الذكاء الاصطناعي' : 'Failed to parse AI response');
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
        
        res.status(500).json({ 
            error: {
                message: error.response?.data?.error?.message || error.message,
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
