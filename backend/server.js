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
const API_URL = "https://openrouter.ai/api/v1/chat/completions";
const API_KEY = "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";
const MODEL = "google/gemini-2.0-flash-exp:free";

// API Keys for external services
const WEATHER_API_KEY = "d701b1c771740ae18c33267ff2da7c8d"; // OpenWeatherMap API key
const CURRENCY_API_KEY = "64a23a612eb109bc1aa19adb"; // ExchangeRate API key
const UNSPLASH_API_KEY = "MhKFGuoBsYUjMVG-aih3dwVt7VhK1TJT6i9z78-x-gw"; // Unsplash API key

// Check if API key is configured
if (!API_KEY) {
    console.warn('⚠️  No OpenRouter API key found. AI features will be disabled.');
} else {
    console.log('✅ Using OpenRouter API for AI features');
}

// In-memory storage for demo (use database in production)
const savedItineraries = new Map();

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

function generatePrompt(startDate, endDate, destination, preferences, language, travelers = 1) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    
    const isArabic = language === 'ar';
    
    // Simple and cute prompt
    return `${isArabic ? 'اجعل رحلتي رائعة! 🌟' : 'Make my trip amazing! 🌟'} 
    
    ${isArabic ? 'أريد رحلة جميلة لمدة' : 'I want a beautiful'} ${days}${isArabic ? ' أيام إلى' : '-day trip to'} ${destination} ✈️
    ${isArabic ? 'عدد المسافرين:' : 'Travelers:'} ${travelers} ${isArabic ? 'شخص' : 'person(s)'} 👥
    ${isArabic ? 'من' : 'From'} ${startDate} ${isArabic ? 'إلى' : 'to'} ${endDate} 📅
    ${isArabic ? 'أحب:' : 'I love:'} ${preferences.length > 0 ? preferences.join(', ') : (isArabic ? 'الاستكشاف' : 'exploring')} ❤️
    
    ${isArabic ? 'اجعل خطتي بسيطة وممتعة وسهلة المتابعة! 😊' : 'Make my plan simple, fun, and easy to follow! 😊'}
    
    ${isArabic ? 'أريد نشاطين أو ثلاثة في كل يوم، مع أوقات بسيطة ووصف جميل.' : 'I want 2-3 activities per day with simple times and beautiful descriptions.'}
    
    ${isArabic ? 'اكتب الرد كـ JSON بهذا الشكل الجميل:' : 'Write the response as JSON in this cute format:'}
    [
        {
            "day": 1,
            "activities": [
                {
                    "title": "${isArabic ? 'نشاط صباحي جميل' : 'Beautiful morning activity'}",
                    "description": "${isArabic ? 'وصف بسيط وجذاب للنشاط' : 'Simple and attractive description'}",
                    "time": "${isArabic ? '10:00 ص' : '10:00 AM'}"
                }
            ]
        }
    ]
    
    ${isArabic ? 'اجعل كل شيء بسيط وجميل وممتع! 🎉' : 'Make everything simple, beautiful, and fun! 🎉'}`;
}

// API routes
app.use('/api', express.Router()
    .post("/generate-itinerary", async (req, res) => {
        const startTime = Date.now();
        const requestId = Math.random().toString(36).substring(7);
        
        console.log(`[${requestId}] Starting itinerary generation`);
          try {
            const { startDate, endDate, destination, preferences, language, travelers } = req.body;
              // Check if OpenRouter API service is available
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

            const prompt = generatePrompt(startDate, endDate, destination, preferences, language, travelers);
              let response;
            try {
                // Use OpenRouter API
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
    })    // 🌤️ Weather API
    .get("/weather/:city", async (req, res) => {
        try {
            const { city } = req.params;
            const { language = 'en' } = req.query;
            
            if (WEATHER_API_KEY === "demo_key") {
                // Demo weather data fallback
                const mockWeatherData = {
                    city: city,
                    country: "Demo Country",
                    current: {
                        temperature: Math.floor(Math.random() * 30) + 15,
                        description: language === 'ar' ? 'غائم جزئياً' : 'Partly Cloudy',
                        humidity: Math.floor(Math.random() * 40) + 40,
                        windSpeed: Math.floor(Math.random() * 15) + 5,
                        icon: '02d'
                    },
                    forecast: Array.from({ length: 5 }, (_, i) => ({
                        date: new Date(Date.now() + (i + 1) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                        temperature: {
                            min: Math.floor(Math.random() * 15) + 10,
                            max: Math.floor(Math.random() * 20) + 20
                        },
                        description: language === 'ar' ? 'مشمس' : 'Sunny',
                        icon: '01d'
                    }))
                };
                return res.json(mockWeatherData);
            }

            // Real OpenWeatherMap API calls
            const weatherLang = language === 'ar' ? 'ar' : 'en';
            
            // Get current weather
            const currentWeatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${WEATHER_API_KEY}&units=metric&lang=${weatherLang}`;
            const currentResponse = await axios.get(currentWeatherUrl);
            const currentData = currentResponse.data;
            
            // Get forecast
            const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&appid=${WEATHER_API_KEY}&units=metric&lang=${weatherLang}`;
            const forecastResponse = await axios.get(forecastUrl);
            const forecastData = forecastResponse.data;
            
            // Process forecast data (get daily forecast)
            const dailyForecast = [];
            const processedDates = new Set();
            
            forecastData.list.forEach(item => {
                const date = item.dt_txt.split(' ')[0];
                if (!processedDates.has(date) && dailyForecast.length < 5) {
                    processedDates.add(date);
                    dailyForecast.push({
                        date: date,
                        temperature: {
                            min: Math.round(item.main.temp_min),
                            max: Math.round(item.main.temp_max)
                        },
                        description: item.weather[0].description,
                        icon: item.weather[0].icon
                    });
                }
            });

            const weatherData = {
                city: currentData.name,
                country: currentData.sys.country,
                current: {
                    temperature: Math.round(currentData.main.temp),
                    description: currentData.weather[0].description,
                    humidity: currentData.main.humidity,
                    windSpeed: Math.round(currentData.wind.speed * 3.6), // Convert m/s to km/h
                    icon: currentData.weather[0].icon
                },
                forecast: dailyForecast
            };

            res.json(weatherData);
        } catch (error) {
            console.error('Weather API Error:', error.response?.data || error.message);
            res.status(500).json({ error: { message: 'Failed to fetch weather data' } });
        }
    })    // 💰 Budget Estimation API
    .post("/estimate-budget", async (req, res) => {
        try {
            const { destination, startDate, endDate, travelers = 1, budgetType = 'medium' } = req.body;
            
            const start = new Date(startDate);
            const end = new Date(endDate);
            const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
            
            // Budget multipliers based on type
            const multipliers = {
                budget: 0.7,
                medium: 1.0,
                luxury: 1.8
            };
            
            const multiplier = multipliers[budgetType] || 1.0;
            
            // Base daily costs (in USD)
            const baseCosts = {
                accommodation: 80 * multiplier,
                food: 40 * multiplier,
                transport: 30 * multiplier,
                activities: 50 * multiplier,
                shopping: 25 * multiplier,
                miscellaneous: 20 * multiplier
            };
            
            const breakdown = {};
            let total = 0;
            
            Object.entries(baseCosts).forEach(([category, dailyCost]) => {
                const categoryTotal = dailyCost * days * travelers;
                breakdown[category] = {
                    daily: Math.round(dailyCost),
                    total: Math.round(categoryTotal)
                };
                total += categoryTotal;
            });
            
            res.json({
                destination,
                duration: days,
                travelers,
                budgetType,
                currency: 'USD',
                total: Math.round(total),
                breakdown,
                recommendations: [
                    budgetType === 'budget' ? 'Consider hostels and street food' : null,
                    budgetType === 'luxury' ? 'Include spa treatments and fine dining' : null,
                    'Book flights 2-3 months in advance for better prices',
                    'Look for package deals that include accommodation and activities'
                ].filter(Boolean)
            });
        } catch (error) {
            res.status(500).json({ error: { message: error.message } });
        }
    })

    // 🧳 Packing List API
    .post("/packing-list", async (req, res) => {
        try {
            const { destination, startDate, endDate, activities = [], language = 'en' } = req.body;
            
            const start = new Date(startDate);
            const end = new Date(endDate);
            const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
            
            // Generate AI-powered packing list
            const prompt = `Generate a comprehensive packing list for a ${days}-day trip to ${destination}. 
            Activities include: ${activities.join(', ')}.
            ${language === 'ar' ? 'اكتب القائمة باللغة العربية' : 'Write the list in English'}.
            
            Format as JSON with categories: clothing, toiletries, electronics, documents, health, accessories.
            Each category should have an array of items with name and importance (essential/recommended/optional).`;
            
            // For demo, return a mock packing list
            const packingList = {
                clothing: [
                    { name: language === 'ar' ? 'ملابس داخلية' : 'Underwear', importance: 'essential' },
                    { name: language === 'ar' ? 'جوارب' : 'Socks', importance: 'essential' },
                    { name: language === 'ar' ? 'قمصان' : 'T-shirts', importance: 'essential' },
                    { name: language === 'ar' ? 'بنطلون' : 'Pants', importance: 'essential' },
                    { name: language === 'ar' ? 'جاكيت' : 'Jacket', importance: 'recommended' }
                ],
                toiletries: [
                    { name: language === 'ar' ? 'فرشاة أسنان' : 'Toothbrush', importance: 'essential' },
                    { name: language === 'ar' ? 'معجون أسنان' : 'Toothpaste', importance: 'essential' },
                    { name: language === 'ar' ? 'شامبو' : 'Shampoo', importance: 'essential' },
                    { name: language === 'ar' ? 'واقي الشمس' : 'Sunscreen', importance: 'recommended' }
                ],
                electronics: [
                    { name: language === 'ar' ? 'شاحن الهاتف' : 'Phone charger', importance: 'essential' },
                    { name: language === 'ar' ? 'كاميرا' : 'Camera', importance: 'recommended' },
                    { name: language === 'ar' ? 'سماعات' : 'Headphones', importance: 'optional' }
                ],
                documents: [
                    { name: language === 'ar' ? 'جواز السفر' : 'Passport', importance: 'essential' },
                    { name: language === 'ar' ? 'تذاكر الطيران' : 'Flight tickets', importance: 'essential' },
                    { name: language === 'ar' ? 'تأمين السفر' : 'Travel insurance', importance: 'recommended' }
                ],
                health: [
                    { name: language === 'ar' ? 'الأدوية الشخصية' : 'Personal medications', importance: 'essential' },
                    { name: language === 'ar' ? 'علبة إسعافات أولية' : 'First aid kit', importance: 'recommended' }
                ],
                accessories: [
                    { name: language === 'ar' ? 'نظارات شمسية' : 'Sunglasses', importance: 'recommended' },
                    { name: language === 'ar' ? 'قبعة' : 'Hat', importance: 'optional' },
                    { name: language === 'ar' ? 'حقيبة يد' : 'Daypack', importance: 'recommended' }
                ]
            };
            
            res.json({
                destination,
                duration: days,
                packingList,
                totalItems: Object.values(packingList).reduce((total, category) => total + category.length, 0),
                essentialItems: Object.values(packingList).reduce((total, category) => 
                    total + category.filter(item => item.importance === 'essential').length, 0)
            });
        } catch (error) {
            res.status(500).json({ error: { message: error.message } });
        }
    })

    // 💡 Travel Tips API
    .post("/travel-tips", async (req, res) => {
        try {
            const { destination, language = 'en' } = req.body;
            
            // Demo travel tips (replace with AI-generated content)
            const tips = {
                cultural: [
                    language === 'ar' ? 'احترم التقاليد المحلية' : 'Respect local customs and traditions',
                    language === 'ar' ? 'تعلم بعض العبارات الأساسية' : 'Learn basic phrases in the local language',
                    language === 'ar' ? 'اللباس المناسب للثقافة المحلية' : 'Dress appropriately for the local culture'
                ],
                safety: [
                    language === 'ar' ? 'احتفظ بنسخ من وثائقك المهمة' : 'Keep copies of important documents',
                    language === 'ar' ? 'شارك خطة رحلتك مع أحد' : 'Share your itinerary with someone',
                    language === 'ar' ? 'احتفظ بأرقام الطوارئ' : 'Keep emergency contact numbers handy'
                ],
                money: [
                    language === 'ar' ? 'استخدم بطاقات ائتمان آمنة' : 'Use secure credit cards',
                    language === 'ar' ? 'احمل بعض النقود المحلية' : 'Carry some local currency',
                    language === 'ar' ? 'تجنب الصرافات غير الآمنة' : 'Avoid unsafe ATMs'
                ],
                health: [
                    language === 'ar' ? 'احصل على التطعيمات المطلوبة' : 'Get required vaccinations',
                    language === 'ar' ? 'اشرب الماء المعبأ في زجاجات' : 'Drink bottled water',
                    language === 'ar' ? 'احمل تأمين صحي للسفر' : 'Carry travel health insurance'
                ]
            };
            
            res.json({
                destination,
                tips,
                language,
                lastUpdated: new Date().toISOString()
            });
        } catch (error) {
            res.status(500).json({ error: { message: error.message } });
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
            "Weather Forecasts",
            "Budget Estimation",
            "Packing Lists",
            "Travel Tips",
            "Photo Galleries",
            "Itinerary Sharing"
        ]
    });
});

app.listen(PORT, () => {
    console.log(`✅ Server running at http://localhost:${PORT}`);
    console.log(`📝 Enhanced API Documentation:`);
    console.log(`   POST /api/generate-itinerary - Generate travel itinerary`);
    console.log(`   GET  /api/weather/:city - Get weather forecast`);
    console.log(`   POST /api/estimate-budget - Budget estimation`);
    console.log(`   POST /api/packing-list - Generate packing list`);
    console.log(`   POST /api/travel-tips - Get travel tips`);
    console.log(`   GET  /api/photos/:destination - Destination photos`);
    console.log(`   POST /api/save-itinerary - Save and share itinerary`);
    console.log(`   GET  /api/shared/:id - Retrieve shared itinerary`);
    console.log(`   GET  /api/health - Check server health`);
    console.log(`\n🚀 Enhanced features now available!`);
});
