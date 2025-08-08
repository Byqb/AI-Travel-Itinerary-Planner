const express = require("express");
const axios = require("axios");
const router = express.Router();

const { API_URL, API_KEY, MODEL } = require("./openrouter");
const generatePrompt = require("./generatePrompt");

router.post("/generate-itinerary", async (req, res) => {
    const startTime = Date.now();
    const requestId = Math.random().toString(36).substring(7);
    console.log(`[${requestId}] Starting itinerary generation`);

    try {
        const { startDate, endDate, destination, preferences, language } = req.body;
        if (!startDate || !endDate || !destination) {
            throw new Error(language === 'ar' ? 'جميع الحقول مطلوبة' : 'All fields are required');
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            throw new Error(language === 'ar' ? 'تواريخ غير صالحة' : 'Invalid dates');
        }
        if (start > end) {
            throw new Error(language === 'ar' ? 'تاريخ البداية يجب أن يكون قبل تاريخ النهاية' : 'Start date must be before end date');
        }

        const prompt = generatePrompt(startDate, endDate, destination, preferences, language);

        let response;
        try {
            response = await axios.post(API_URL, {
                model: MODEL,
                messages: [{ role: "user", content: prompt }]
            }, {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${API_KEY}`,
                    "HTTP-Referer": "http://localhost:3000",
                    "X-Title": "ai-travel-planner"
                },
                timeout: 30000
            });
        } catch (apiError) {
            console.error(`[${requestId}] API Error:`, apiError.response?.data || apiError.message);
            throw new Error(language === 'ar'
                ? 'فشل الاتصال بخدمة الذكاء الاصطناعي. يرجى المحاولة مرة أخرى لاحقاً.'
                : 'Failed to connect to AI service. Please try again later.');
        }

        if (!response.data || !response.data.choices || !response.data.choices[0]?.message?.content) {
            throw new Error(language === 'ar'
                ? 'استجابة غير صالحة من خدمة الذكاء الاصطناعي'
                : 'Invalid response from AI service');
        }

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
                            currentDay = { day: dayNum, activities: [] };
                            itinerary.push(currentDay);
                        } else if (currentDay && line.trim()) {
                            currentDay.activities.push({ title: line.trim(), description: '' });
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

        const processingTime = Date.now() - startTime;
        console.log(`[${requestId}] Itinerary generated in ${processingTime}ms`);

        res.json({ itinerary, debug: { requestId, processingTime, model: MODEL, timestamp: new Date().toISOString() } });
    } catch (error) {
        const errorTime = Date.now() - startTime;
        console.error(`[${requestId}] Error after ${errorTime}ms:`, error.message);
        res.status(500).json({ error: { message: error.message, requestId, processingTime: errorTime, timestamp: new Date().toISOString() } });
    }
});

module.exports = router;