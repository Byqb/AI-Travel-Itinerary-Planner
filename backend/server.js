const express = require("express");
const axios = require("axios");
const cors = require("cors");
const { v4: uuidv4 } = require('uuid');
const compression = require('compression');
const helmet = require('helmet');
require('dotenv').config(); // Load environment variables

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ API Keys and Configuration (from environment variables)
const API_URL = process.env.API_URL || "https://openrouter.ai/api/v1/chat/completions";
const API_KEY = process.env.API_KEY;
const MODEL = process.env.MODEL || "google/gemini-2.0-flash-exp:free";

// API Keys for external services
const UNSPLASH_API_KEY = "MhKFGuoBsYUjMVG-aih3dwVt7VhK1TJT6i9z78-x-gw"; // Unsplash API key

// Check if API key is configured
if (!API_KEY) {
    console.warn('⚠️  No AI API key found. AI features will be disabled.');
} else if (API_KEY) {
    console.log('✅ Using OpenRouter API for AI features');
}

// In-memory storage for demo (use database in production)
const savedItineraries = new Map();
// In-memory chat sessions for itinerary planning
const chatSessions = new Map();

// Enhanced Middleware
app.use(helmet({
    contentSecurityPolicy: false // Disable for demo, configure properly in production
}));
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
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
    
    return `${isArabic ? 'إنشاء' : 'Create'} a detailed ${days}-day travel itinerary for a trip to ${destination}. 
    ${isArabic ? 'تبدأ الرحلة في' : 'The trip starts on'} ${startDate} ${isArabic ? 'وتنتهي في' : 'and ends on'} ${endDate}.
    ${isArabic ? 'الاهتمامات:' : 'Travel preferences:'} ${preferences.join(', ')}.
    
    ${isArabic ? 'يرجى تقديم خطة يومية تتضمن:' : 'Please provide a day-by-day itinerary with:'}
    1. ${isArabic ? '3-4 نشاطات في اليوم' : '3-4 activities per day'}
    2. ${isArabic ? 'وصف مختصر ومفيد لكل نشاط' : 'Brief and helpful descriptions for each activity'}
    3. ${isArabic ? 'مراعاة الاهتمامات المذكورة' : 'Consider the preferences mentioned'}
    4. ${isArabic ? 'جعلها واقعية وعملية' : 'Make it realistic and practical'}
    5. ${isArabic ? 'تضمين أوقات تقريبية للأنشطة' : 'Include approximate timings for activities'}
    
    ${isArabic ? 'قم بتنسيق الرد كمصفوفة JSON من الأيام، حيث يحتوي كل يوم على:' : 'Format the response as a JSON array of days, where each day has:'}
    - day: number
    - activities: array of {title: string, description: string, time?: string}
    
    ${isArabic ? 'مثال على التنسيق:' : 'Example format:'}
    [
        {
            "day": 1,
            "activities": [
                {
                    "title": "${isArabic ? 'نشاط الصباح' : 'Morning Activity'}",
                    "description": "${isArabic ? 'الوصف المفصل هنا' : 'Detailed description here'}",
                    "time": "${isArabic ? '9:00 صباحاً' : '9:00 AM'}"
                }
            ]
        }
    ]`;
}

// API routes
app.use('/api', express.Router()
    .post("/generate-itinerary", async (req, res) => {
        const startTime = Date.now();
        const requestId = Math.random().toString(36).substring(7);
        
        console.log(`[${requestId}] Starting itinerary generation`);
          try {
                        const { startDate, endDate, destination, preferences, language } = req.body;
                            // Check if AI service is available
                        if (!API_KEY) {
                throw new Error(
                    language === 'ar' 
                        ? 'خدمة الذكاء الاصطناعي غير متوفرة حالياً'
                        : 'AI service is currently unavailable'
                );
            }
            
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
                                // Use OpenRouter API
                                if (API_KEY) {
                    console.log(`[${requestId}] Using OpenRouter API`);
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
                            timeout: 30000
                        }
                    );
                } else {
                    throw new Error('No AI service available');
                }
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
                const jsonMatch = reply.match(/\[\s*\{[\s\S]*\}\s*\]/);
                if (jsonMatch) {
                    itinerary = JSON.parse(jsonMatch[0]);
                } else {
                    try {
                        itinerary = JSON.parse(reply);
                    } catch {
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

                if (!Array.isArray(itinerary) || itinerary.length === 0) {
                    throw new Error(language === 'ar' ? 'تنسيق الخطة غير صالح' : 'Invalid plan format');
                }

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
    })    // 📸 Destination Photos API
    .get("/photos/:destination", async (req, res) => {
        try {
            const { destination } = req.params;
            
            if (UNSPLASH_API_KEY === "demo_key") {
                // Demo photo data fallback
                const photos = Array.from({ length: 8 }, (_, i) => ({
                    id: `photo_${i + 1}`,
                    url: `https://picsum.photos/800/600?random=${i + 1}`,
                    thumbnail: `https://picsum.photos/300/200?random=${i + 1}`,
                    description: `Beautiful view of ${destination} ${i + 1}`,
                    photographer: `Photographer ${i + 1}`,
                    photographerUrl: '#'
                }));
                
                return res.json({
                    destination,
                    photos,
                    total: photos.length
                });
            }

            // Real Unsplash API call
            const unsplashUrl = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(destination)}&per_page=12&orientation=landscape`;
            const response = await axios.get(unsplashUrl, {
                headers: {
                    'Authorization': `Client-ID ${UNSPLASH_API_KEY}`
                }
            });
            
            const data = response.data;
            const photos = data.results.map(photo => ({
                id: photo.id,
                url: photo.urls.regular,
                thumbnail: photo.urls.small,
                description: photo.alt_description || `Beautiful view of ${destination}`,
                photographer: photo.user.name,
                photographerUrl: photo.user.links.html,
                downloadLocation: photo.links.download_location
            }));
            
            res.json({
                destination,
                photos,
                total: photos.length
            });
        } catch (error) {
            console.error('Unsplash API Error:', error.response?.data || error.message);
            res.status(500).json({ error: { message: 'Failed to fetch photos' } });
        }
    })

    // 💾 Save Itinerary API
    .post("/save-itinerary", async (req, res) => {
        try {
            const { itinerary, destination, startDate, endDate, preferences, language } = req.body;
            const id = uuidv4();
            
            const savedItinerary = {
                id,
                itinerary,
                destination,
                startDate,
                endDate,
                preferences,
                language,
                createdAt: new Date().toISOString(),
                views: 0
            };
            
            savedItineraries.set(id, savedItinerary);
            
            res.json({
                id,
                shareUrl: `${req.protocol}://${req.get('host')}/shared/${id}`,
                message: language === 'ar' ? 'تم حفظ الخطة بنجاح' : 'Itinerary saved successfully'
            });
        } catch (error) {
            res.status(500).json({ error: { message: error.message } });
        }
    })

    // 🔗 Get Shared Itinerary API
    .get("/shared/:id", async (req, res) => {
        try {
            const { id } = req.params;
            const itinerary = savedItineraries.get(id);
            
            if (!itinerary) {
                return res.status(404).json({ 
                    error: { message: 'Itinerary not found' } 
                });
            }
            
            // Increment view count
            itinerary.views += 1;
            savedItineraries.set(id, itinerary);
            
            res.json(itinerary);
        } catch (error) {
            res.status(500).json({ error: { message: error.message } });
        }
    })    // 🤖 AI Travel Assistant API
    .post("/ai-assistant", async (req, res) => {
        try {
            const { message, language = 'en', context = {} } = req.body;
            
            // Check if AI service is available
            if (!API_KEY) {
                return res.status(503).json({
                    error: {
                        message: language === 'ar' 
                            ? 'خدمة الذكاء الاصطناعي غير متوفرة حالياً'
                            : 'AI service is currently unavailable',
                        code: 'AI_SERVICE_UNAVAILABLE'
                    }
                });
            }
            
            if (!message) {
                return res.status(400).json({
                    error: {
                        message: language === 'ar' ? 'الرسالة مطلوبة' : 'Message is required'
                    }
                });
            }
              const prompt = `You are a helpful travel assistant. ${language === 'ar' ? 'أجب باللغة العربية' : 'Respond in English'}.
            User question: ${message}
            Context: ${JSON.stringify(context)}
            
            Provide helpful, accurate travel advice. Keep responses concise and practical.
            
            Format your response using markdown for better readability:
            - Use **bold** for important points
            - Use *italic* for emphasis
            - Use ### for section headers when needed
            - Use - for bullet points when listing items
            - Use \`code\` for specific names, places, or instructions
            
            Keep responses conversational but well-structured.`;
            
            console.log('AI Assistant Request:', { message, language });
            
            let reply;
            
            if (API_KEY) {
                // Use OpenRouter
                console.log('Using OpenRouter API');
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
                            "HTTP-Referer": process.env.APP_URL || "http://localhost:3000",
                            "X-Title": "ai-travel-assistant"
                        },
                        timeout: 15000
                    }
                );
                
                if (!response.data?.choices?.[0]?.message?.content) {
                    throw new Error('Invalid AI response from OpenRouter');
                }
                
                reply = response.data.choices[0].message.content;
            }
            
            res.json({
                response: reply,
                timestamp: new Date().toISOString(),
                provider: 'openrouter'
            });
        } catch (error) {
            console.error('AI Assistant Error:', error.response?.data || error.message);
            
            const { language = 'en' } = req.body; // Get language from request body for error messages
            
            if (error.response?.status === 401) {
                res.status(503).json({
                    error: {
                        message: language === 'ar' 
                            ? 'خدمة الذكاء الاصطناعي غير متوفرة حالياً'
                            : 'AI service authentication failed',
                        code: 'AI_AUTH_FAILED'
                    }
                });
            } else {
                res.status(500).json({
                    error: {
                        message: language === 'ar' 
                            ? 'حدث خطأ في خدمة الذكاء الاصطناعي'
                            : 'AI service error',
                        details: error.message
                    }
                });
            }
        }
    })

    // 💬 Itinerary Chat API (plan + refine via conversation)
    .post('/itinerary-chat', async (req, res) => {
        try {
            const { chatId, message, language = 'en' } = req.body;
            if (!API_KEY) {
                return res.status(503).json({ error: { message: 'AI service is currently unavailable' } });
            }
            if (!message || typeof message !== 'string') {
                return res.status(400).json({ error: { message: 'Message is required' } });
            }

            // Get or create session
            const id = chatId || uuidv4();
            const session = chatSessions.get(id) || {
                history: [],
                itinerary: null,
                meta: { destination: '', startDate: '', endDate: '', interests: [] },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            // Build system instructions to always return a strict JSON object
            const isArabic = language === 'ar';
                        const system = (
                isArabic
                                        ? `أنت مخطط رحلات عبر الدردشة. تحدث باختصار واطلب أي معلومات ناقصة (تاريخ البداية، تاريخ النهاية، الوجهة، الاهتمامات).
عند ذكر الاهتمامات من قبل المستخدم، انسخ الكلمات نفسها بدون ترجمة أو إعادة صياغة أو إضافة اهتمامات جديدة. لا تقترح اهتمامات إضافية إلا إذا طلب المستخدم ذلك صراحة.
عندما تكون المعلومات كافية، أنشئ أو حدّث خطة الرحلة اليومية بناءً على الاهتمامات المذكورة فقط.
أعد دائماً استجابة JSON فقط بهذه البنية:
{
  "reply": "نص موجز للمستخدم",
    "meta": {"destination": string, "startDate": string, "endDate": string, "interests": string[]},
  "itinerary": [ {"day": number, "activities": [{"title": string, "description": string, "time"?: string}] } ] | null
}
لا تُرجع أي نص خارج JSON.`
                                        : `You are a chat-based trip planner. Be concise. Ask for any missing info (start date, end date, destination, interests).
When the user states interests, copy their words exactly into an interests array, without translating, rephrasing, or adding new interests. Do not infer or add interests unless the user explicitly asks.
When enough info exists, create or update a day-by-day itinerary strictly aligned to the stated interests only.
Always return JSON only with this exact shape:
{
  "reply": "short assistant message",
    "meta": {"destination": string, "startDate": string, "endDate": string, "interests": string[]},
  "itinerary": [ {"day": number, "activities": [{"title": string, "description": string, "time"?: string}] } ] | null
}
Do not include any text outside JSON.`
            );

            // Compose messages: system + session history + new user message
            const messages = [
                { role: 'system', content: system },
                ...session.history,
                { role: 'user', content: message }
            ];

            // Call OpenRouter
            const response = await axios.post(
                API_URL,
                {
                    model: MODEL,
                    messages
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${API_KEY}`,
                        'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
                        'X-Title': 'itinerary-chat'
                    },
                    timeout: 30000
                }
            );

            const content = response.data?.choices?.[0]?.message?.content || '';

            // Try to parse JSON strictly; if failed, attempt to extract JSON object
            let payload;
            try {
                payload = JSON.parse(content);
            } catch (_) {
                const match = content.match(/\{[\s\S]*\}/);
                if (match) {
                    try { payload = JSON.parse(match[0]); } catch { /* ignore */ }
                }
            }

            let replyText = '';
            let itinerary = null;
            let meta = session.meta;
            if (payload && typeof payload === 'object') {
                if (typeof payload.reply === 'string') replyText = payload.reply;
                if (payload.meta && typeof payload.meta === 'object') {
                    meta = {
                        destination: payload.meta.destination || meta.destination || '',
                        startDate: payload.meta.startDate || meta.startDate || '',
                        endDate: payload.meta.endDate || meta.endDate || '',
                        // Do NOT override interests here; the UI decides and sends via save/generate endpoints
                        interests: Array.isArray(meta.interests) ? meta.interests : []
                    };
                }
                if (Array.isArray(payload.itinerary)) {
                    // Normalize itinerary
                    itinerary = payload.itinerary.map(day => ({
                        day: Number(day.day) || 1,
                        activities: Array.isArray(day.activities) ? day.activities.map(a => ({
                            title: a.title || '',
                            description: a.description || '',
                            time: a.time || undefined
                        })) : []
                    }));
                }
            }

            // Fallback reply if parsing failed
            if (!replyText) {
                replyText = isArabic ? 'يرجى توضيح الرسالة.' : 'Please clarify your request.';
            }

            // Update session history and state
            session.history.push({ role: 'user', content: message });
            session.history.push({ role: 'assistant', content: replyText });
            session.meta = meta;
            if (itinerary) session.itinerary = itinerary;
            session.updatedAt = new Date().toISOString();
            chatSessions.set(id, session);

            res.json({
                chatId: id,
                reply: replyText,
                meta,
                itinerary: session.itinerary || null
            });
        } catch (error) {
            console.error('Itinerary Chat Error:', error.response?.data || error.message);
            res.status(500).json({ error: { message: 'Chat service error' } });
        }
    })
);

// Health check endpoint
app.get("/api/health", (req, res) => {
    res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: "2.0.0",
        features: [
            "AI Itinerary Generation",
            "Photo Galleries",
            "Itinerary Sharing",
            "AI Travel Assistant"
        ]
    });
});

app.listen(PORT, () => {
    console.log(`✅ Server running at http://localhost:${PORT}`);
    console.log(`📝 Enhanced API Documentation:`);
    console.log(`   POST /api/generate-itinerary - Generate travel itinerary`);
    console.log(`   POST /api/itinerary-chat - Plan and refine via chat`);
    console.log(`   GET  /api/photos/:destination - Destination photos`);
    console.log(`   POST /api/save-itinerary - Save and share itinerary`);
    console.log(`   GET  /api/shared/:id - Retrieve shared itinerary`);
    console.log(`   POST /api/ai-assistant - AI travel assistant chat`);
    console.log(`   GET  /api/health - Check server health`);
    console.log(`\n🚀 Enhanced features now available!`);
});
