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
        
        // Validate required fields
        if (!startDate || !endDate || !destination) {
            throw new Error(language === 'ar' ? 'جميع الحقول مطلوبة' : 'All fields are required');
        }

        // Validate dates
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            throw new Error(language === 'ar' ? 'تواريخ غير صالحة' : 'Invalid dates');
        }
        if (start > end) {
            throw new Error(language === 'ar' ? 'تاريخ البداية يجب أن يكون قبل تاريخ النهاية' : 'Start date must be before end date');
        }

        console.log(`[${requestId}] Generating itinerary for ${destination} in ${language}`);

        const prompt = generatePrompt(startDate, endDate, destination, preferences, language);
        
        let response;
        try {
            response = await axios.post(
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
                    },
                    timeout: 30000 // 30 second timeout
                }
            );
        } catch (apiError) {
            console.error(`[${requestId}] API Error:`, apiError.response?.data || apiError.message);
            throw new Error(
                language === 'ar' 
                    ? 'فشل الاتصال بخدمة الذكاء الاصطناعي. يرجى المحاولة مرة أخرى لاحقاً.'
                    : 'Failed to connect to AI service. Please try again later.'
            );
        }

        // Validate API response
        if (!response.data || !response.data.choices || !response.data.choices[0]?.message?.content) {
            throw new Error(
                language === 'ar'
                    ? 'استجابة غير صالحة من خدمة الذكاء الاصطناعي'
                    : 'Invalid response from AI service'
            );
        }

        const processingTime = Date.now() - startTime;
        console.log(`[${requestId}] Itinerary generated in ${processingTime}ms`);

        // Parse the AI response to get the itinerary
        const reply = response.data.choices[0].message.content;
        let itinerary;
        try {
            // First try to find JSON array in the response
            const jsonMatch = reply.match(/\[\s*\{[\s\S]*\}\s*\]/);
            if (jsonMatch) {
                itinerary = JSON.parse(jsonMatch[0]);
            } else {
                // If no JSON array found, try to parse the entire response
                try {
                    itinerary = JSON.parse(reply);
                } catch {
                    // If still can't parse, create a structured response from the text
                    const lines = reply.split('\n').filter(line => line.trim());
                    itinerary = [];
                    let currentDay = null;
                    
                    for (const line of lines) {
                        if (line.toLowerCase().includes('day') || line.includes('اليوم')) {
                            const dayNum = parseInt(line.match(/\d+/)?.[0] || '1');
                            currentDay = {
                                day: dayNum,
                                activities: []
                            };
                            itinerary.push(currentDay);
                        } else if (currentDay && line.trim()) {
                            const activity = {
                                title: line.trim(),
                                description: ''
                            };
                            currentDay.activities.push(activity);
                        }
                    }
                    
                    if (itinerary.length === 0) {
                        throw new Error(language === 'ar' ? 'لم يتم العثور على خطة سفر صالحة' : 'No valid travel plan found');
                    }
                }
            }

            // Validate itinerary structure
            if (!Array.isArray(itinerary) || itinerary.length === 0) {
                throw new Error(language === 'ar' ? 'تنسيق الخطة غير صالح' : 'Invalid plan format');
            }

            // Ensure each day has required fields
            itinerary = itinerary.map(day => ({
                day: day.day || 1,
                activities: Array.isArray(day.activities) ? day.activities.map(activity => ({
                    title: activity.title || '',
                    description: activity.description || ''
                })) : []
            }));

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
        console.error(`[${requestId}] Error after ${errorTime}ms:`, error.message);
        
        res.status(500).json({ 
            error: {
                message: error.message,
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
