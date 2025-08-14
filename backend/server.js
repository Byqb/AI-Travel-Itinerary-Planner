const express = require("express");
const path = require('path');
const axios = require("axios");
const cors = require("cors");
const { v4: uuidv4 } = require('uuid');
const compression = require('compression');
const helmet = require('helmet');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

// API config
const API_URL = process.env.API_URL || "https://openrouter.ai/api/v1/chat/completions";
const API_KEY = process.env.API_KEY;
const MODEL = process.env.MODEL || "google/gemma-3n-e4b-it:free";
//google/gemini-2.0-flash-exp:free

// External services
const UNSPLASH_API_KEY = "MhKFGuoBsYUjMVG-aih3dwVt7VhK1TJT6i9z78-x-gw"; // demo key placeholder

// Log API key status
if (!API_KEY) {
    console.warn('⚠️  No AI API key found. AI features will be disabled.');
} else {
    console.log('✅ Using OpenRouter API for AI features');
}

// In-memory stores (legacy public share & ephemeral chat)
const savedItineraries = new Map();
const chatSessions = new Map();

// SQLite setup
const db = new sqlite3.Database(process.env.SQLITE_DB || `${__dirname}/database.sqlite`);
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT,
        created_at TEXT NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS itineraries (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        title TEXT,
        destination TEXT,
        start_date TEXT,
        end_date TEXT,
        language TEXT,
        plan_json TEXT,
        archived INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        itinerary_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (itinerary_id) REFERENCES itineraries(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS itinerary_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        itinerary_id TEXT NOT NULL,
        version_number INTEGER NOT NULL,
        plan_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (itinerary_id) REFERENCES itineraries(id)
    )`);
});

function runAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) return reject(err);
            resolve(this);
        });
    });
}
function getAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) return reject(err);
            resolve(row);
        });
    });
}
function allAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
}
const userItineraries = new Map(); // drafts/editable itineraries before sharing

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(session({
    name: process.env.SESSION_NAME || 'sid',
    store: new SQLiteStore({ db: process.env.SESSIONS_DB || 'sessions.sqlite', dir: __dirname }),
    secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 7,
        httpOnly: true,
        sameSite: 'lax',
        secure: isProd
    }
}));
// Redirect unauthenticated users hitting root to /auth
app.get('/', (req, res, next) => {
    if (!req.session?.userId) {
        return res.redirect('/auth');
    }
    next();
});
app.use(express.static("public"));

// Debug logging
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    if (req.body && Object.keys(req.body).length > 0) {
        console.log('Request Body:', JSON.stringify(req.body, null, 2));
    }
    next();
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Server Error:', err);
    res.status(500).json({ error: { message: 'Internal Server Error', details: err.message, timestamp: new Date().toISOString() } });
});

function generatePrompt(startDate, endDate, destination, preferences, language) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    const isArabic = language === 'ar';
    const interests = preferences.join(', ');

    return (
`${isArabic ? 'أنت مخطط رحلات.' : "You're a trip planner."} ${isArabic ? 'أنشئ خطة يومية مفصلة بمواعيد مناسبة ووصف قصير لكل نشاط.' : 'Create a detailed daily plan with suitable times and a short description for each activity.'}

Trip: ${destination}
Start: ${startDate}
End: ${endDate}
Interests (copy exactly): ${interests}
Days: ${days}

Strict rules:
- ${isArabic ? 'لكل يوم ثلاث فترات بالترتيب: Morning, Midday, End of day — نشاط واحد لكل فترة.' : 'Each day must have three periods in order: Morning, Midday, End of day — exactly one activity per period.'}
- ${isArabic ? 'العنوان يطابق الوسم بين أقواس مربعة مثل [food] فقط.' : 'The title must be the tag in square brackets like [food] only.'}
- ${isArabic ? 'الوصف قصير ومفيد (50-80 حرفاً) يشرح النشاط بإيجاز.' : 'The description is short and useful (50-80 chars) describing the activity briefly.'}
- ${isArabic ? 'غط جميع الاهتمامات مرة واحدة على الأقل إن أمكن.' : 'Cover all interests at least once during the trip if possible.'}
- ${isArabic ? 'لا تترجم كلمات الاهتمام مطلقاً. استخدمها كما هي بالضبط.' : 'Never translate interest words; use them exactly as given.'}

Return JSON only in this exact shape:
{
  "reply": ${isArabic ? '"نص موجز"' : '"Brief text"'},
  "meta": {"destination": string, "startDate": string, "endDate": string, "interests": string[]},
  "itinerary": [
    {
      "day": number,
      "activities": [
        {"title": "[interest]", "description": "short description", "time": "Morning"},
        {"title": "[interest]", "description": "short description", "time": "Midday"},
        {"title": "[interest]", "description": "short description", "time": "End of day"}
      ]
    }
  ]
}

Important:
- The time values must be exactly: "Morning", "Midday", "End of day".
- Each title must be exactly one bracketed interest from: [${interests}]. No extra words.
- description must be null (or an empty string) for every activity.
`);
}

// Build Router
const router = express.Router();

// Auth helpers
function requireAuth(req, res, next) {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ error: { message: 'Unauthorized' } });
    }
    next();
}

async function getUserById(userId) {
    return await getAsync('SELECT id, email, name, created_at as createdAt FROM users WHERE id = ?', [userId]);
}

// Auth routes
router.post('/auth/register', async (req, res) => {
    try {
        const { email, password, name = '' } = req.body;
        if (!email || !password) return res.status(400).json({ error: { message: 'Email and password are required' } });
        const normalizedEmail = String(email).trim().toLowerCase();
        const emailOk = /.+@.+\..+/.test(normalizedEmail);
        if (!emailOk) return res.status(400).json({ error: { message: 'Invalid email' } });
        if (String(password).length < 8) return res.status(400).json({ error: { message: 'Password must be at least 8 characters' } });
        const existing = await getAsync('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
        if (existing) return res.status(409).json({ error: { message: 'Email already registered' } });
        const hash = await bcrypt.hash(password, 12);
        const now = new Date().toISOString();
        const result = await runAsync('INSERT INTO users (email, password_hash, name, created_at) VALUES (?,?,?,?)', [normalizedEmail, hash, name, now]);
        const userId = result.lastID;
        const user = await getUserById(userId);
        req.session.regenerate(err => {
            if (err) return res.status(500).json({ error: { message: 'Session error' } });
            req.session.userId = userId;
            res.json({ user });
        });
    } catch (err) {
        res.status(500).json({ error: { message: err.message } });
    }
});

router.post('/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: { message: 'Email and password are required' } });
        const normalizedEmail = String(email).trim().toLowerCase();
        const user = await getAsync('SELECT id, email, password_hash FROM users WHERE email = ?', [normalizedEmail]);
        // Use a single error path to avoid leaking user existence
        if (!user) return res.status(401).json({ error: { message: 'Invalid credentials' } });
        const ok = await bcrypt.compare(password, user.password_hash);
        if (!ok) return res.status(401).json({ error: { message: 'Invalid credentials' } });
        const safe = await getUserById(user.id);
        req.session.regenerate(err => {
            if (err) return res.status(500).json({ error: { message: 'Session error' } });
            req.session.userId = user.id;
            res.json({ user: safe });
        });
    } catch (err) {
        res.status(500).json({ error: { message: err.message } });
    }
});

router.post('/auth/logout', (req, res) => {
    const cookieName = process.env.SESSION_NAME || 'sid';
    req.session.destroy(() => {
        res.clearCookie(cookieName, { httpOnly: true, sameSite: 'lax', secure: isProd });
        res.json({ ok: true });
    });
});

router.get('/auth/me', async (req, res) => {
    if (!req.session?.userId) return res.json({ user: null });
    const user = await getUserById(req.session.userId);
    res.json({ user: user || null });
});

// Itineraries CRUD
router.get('/itineraries', requireAuth, async (req, res) => {
    try {
        const rows = await allAsync(`SELECT id, title, destination, start_date as startDate, end_date as endDate, language, archived,
            created_at as createdAt, updated_at as updatedAt FROM itineraries WHERE user_id = ? ORDER BY updated_at DESC`, [req.session.userId]);
        res.json({ itineraries: rows });
    } catch (err) {
        res.status(500).json({ error: { message: err.message } });
    }
});

router.post('/itineraries', requireAuth, async (req, res) => {
    try {
        const { title = '', destination = '', startDate = '', endDate = '', language = 'en', plan } = req.body;
        if (!destination || !startDate || !endDate) return res.status(400).json({ error: { message: 'destination, startDate and endDate are required' } });
        const id = uuidv4();
        const now = new Date().toISOString();
        const planJson = plan ? JSON.stringify(plan) : JSON.stringify({});
        await runAsync('INSERT INTO itineraries (id, user_id, title, destination, start_date, end_date, language, plan_json, archived, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,0,?,?)',
            [id, req.session.userId, title || destination, destination, startDate, endDate, language, planJson, now, now]);
        if (plan) {
            await runAsync('INSERT INTO itinerary_versions (itinerary_id, version_number, plan_json, created_at) VALUES (?,?,?,?)', [id, 1, JSON.stringify(plan), now]);
        }
        res.json({ id });
    } catch (err) {
        res.status(500).json({ error: { message: err.message } });
    }
});

router.get('/itineraries/:id', requireAuth, async (req, res) => {
    try {
        const it = await getAsync('SELECT * FROM itineraries WHERE id = ? AND user_id = ?', [req.params.id, req.session.userId]);
        if (!it) return res.status(404).json({ error: { message: 'Not found' } });
        const msgs = await allAsync('SELECT id, role, content, created_at as createdAt FROM messages WHERE itinerary_id = ? ORDER BY id ASC', [req.params.id]);
        res.json({ itinerary: {
            id: it.id,
            title: it.title,
            destination: it.destination,
            startDate: it.start_date,
            endDate: it.end_date,
            language: it.language,
            archived: !!it.archived,
            createdAt: it.created_at,
            updatedAt: it.updated_at,
            plan: it.plan_json ? JSON.parse(it.plan_json) : null,
        }, messages: msgs });
    } catch (err) {
        res.status(500).json({ error: { message: err.message } });
    }
});

router.put('/itineraries/:id', requireAuth, async (req, res) => {
    try {
        const { title, archived } = req.body;
        const it = await getAsync('SELECT id FROM itineraries WHERE id = ? AND user_id = ?', [req.params.id, req.session.userId]);
        if (!it) return res.status(404).json({ error: { message: 'Not found' } });
        const now = new Date().toISOString();
        await runAsync('UPDATE itineraries SET title = COALESCE(?, title), archived = COALESCE(?, archived), updated_at = ? WHERE id = ?', [title, typeof archived === 'boolean' ? (archived ? 1 : 0) : undefined, now, req.params.id]);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: { message: err.message } });
    }
});

router.delete('/itineraries/:id', requireAuth, async (req, res) => {
    try {
        const it = await getAsync('SELECT id FROM itineraries WHERE id = ? AND user_id = ?', [req.params.id, req.session.userId]);
        if (!it) return res.status(404).json({ error: { message: 'Not found' } });
        await runAsync('DELETE FROM messages WHERE itinerary_id = ?', [req.params.id]);
        await runAsync('DELETE FROM itineraries WHERE id = ?', [req.params.id]);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: { message: err.message } });
    }
});

// (Removed legacy in-memory itineraries endpoints)

// Generate itinerary (strict JSON)
router.post("/generate-itinerary", async (req, res) => {
    const startTime = Date.now();
    const requestId = Math.random().toString(36).substring(7);
    try {
        const { startDate, endDate, destination, preferences = [], language = 'en' } = req.body;
        if (!API_KEY) throw new Error(language === 'ar' ? 'خدمة الذكاء الاصطناعي غير متوفرة حالياً' : 'AI service is currently unavailable');
        if (!startDate || !endDate || !destination) throw new Error(language === 'ar' ? 'جميع الحقول مطلوبة' : 'All fields are required');
        const start = new Date(startDate); const end = new Date(endDate);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) throw new Error(language === 'ar' ? 'تواريخ غير صالحة' : 'Invalid dates');
        if (start > end) throw new Error(language === 'ar' ? 'تاريخ البداية يجب أن يكون قبل تاريخ النهاية' : 'Start date must be before end date');

    const prompt = generatePrompt(startDate, endDate, destination, preferences, language);
        const response = await axios.post(API_URL, { model: MODEL, messages: [{ role: 'user', content: prompt }] }, {
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}`, 'HTTP-Referer': 'http://localhost:3000', 'X-Title': 'ai-travel-planner' },
            timeout: 30000
        });

        const reply = response.data?.choices?.[0]?.message?.content || '';
        const interestsSet = new Set(preferences.map(s => s.trim()));

        // Try to parse object with itinerary or raw array
        let parsed; let itinerary;
    const objMatch = reply.match(/\{[\s\S]*\}/);
    const arrMatch = reply.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (objMatch) { try { parsed = JSON.parse(objMatch[0]); } catch {} }
        if (!parsed && arrMatch) { try { parsed = JSON.parse(arrMatch[0]); } catch {} }
        if (!parsed) { try { parsed = JSON.parse(reply); } catch {} }
        // Itineraries CRUD (Manage multiple plans before generating or sharing)
        if (Array.isArray(parsed)) itinerary = parsed; else if (parsed && Array.isArray(parsed.itinerary)) itinerary = parsed.itinerary;

        // Fallback naive parse
        if (!itinerary) {
            const lines = reply.split('\n').filter(Boolean);
            itinerary = []; let currentDay = null; let dayNum = 1;
            for (const line of lines) {
                if (/day|اليوم/i.test(line)) { currentDay = { day: dayNum++, activities: [] }; itinerary.push(currentDay); }
                else if (currentDay) { currentDay.activities.push({ title: line.trim(), description: '' }); }
            }
            if (itinerary.length === 0) throw new Error(language === 'ar' ? 'لم يتم العثور على خطة سفر صالحة' : 'No valid travel plan found');
        }

        if (!Array.isArray(itinerary) || itinerary.length === 0) throw new Error(language === 'ar' ? 'تنسيق الخطة غير صالح' : 'Invalid plan format');

    // Normalize to strict contract
        itinerary = itinerary.map(day => ({
            day: Number(day.day) || 1,
            activities: Array.isArray(day.activities) ? day.activities.map(a => {
                let title = String(a.title || '').trim();
                const m = title.match(/\[(.*?)\]/); let tag = m ? m[1].trim() : '';
                if (!tag && interestsSet.size) { for (const i of interestsSet) { if (title.toLowerCase().includes(i.toLowerCase())) { tag = i; break; } } }
                if (tag) title = `[${tag}]`;
                let time = a.time; const t = (time || '').toString().toLowerCase();
                if (t.includes('morning') || t.includes('صباح')) time = 'Morning';
                else if (t.includes('midday') || t.includes('منتصف') || t.includes('ظهر')) time = 'Midday';
                else if (t.includes('end of day') || t.includes('مساء') || t.includes('ليل')) time = 'End of day';
                const description = (typeof a.description === 'string') ? a.description.trim() : '';
                return { title, description, time };
            }) : []
        })).map(day => {
            const order = ['Morning','Midday','End of day'];
            const byTime = new Map();
            for (const a of day.activities) { if (!byTime.has(a.time) && order.includes(a.time)) byTime.set(a.time, a); }
            const missing = order.filter(k => !byTime.has(k));
            if (missing.length) {
                const tags = Array.from(interestsSet); let idx = 0;
                for (const k of missing) { const tag = tags.length ? tags[idx % tags.length] : 'interest'; byTime.set(k, { title: `[${tag}]`, description: null, time: k }); idx++; }
            }
            return { day: day.day, activities: order.map(k => byTime.get(k)).filter(Boolean) };
        });

        // Ensure itinerary spans the full date range
        const msPerDay = 24 * 60 * 60 * 1000;
        const daysCount = Math.ceil((end - start) / msPerDay) + 1;
        const order = ['Morning','Midday','End of day'];
        const tags = Array.from(interestsSet);
        let padIdx = 0;
        // Build a map for quick lookup
        const byDay = new Map(itinerary.map(d => [Number(d.day) || 1, d]));
        const normalized = [];
        for (let d = 1; d <= daysCount; d++) {
            if (byDay.has(d)) {
                // ensure exactly 3 slots
                const current = byDay.get(d);
                const byTime2 = new Map();
                for (const a of current.activities) { if (!byTime2.has(a.time) && order.includes(a.time)) byTime2.set(a.time, a); }
                for (const k of order) {
                    if (!byTime2.has(k)) {
                        const tag = tags.length ? tags[padIdx % tags.length] : 'interest';
                        byTime2.set(k, { title: `[${tag}]`, description: null, time: k });
                        padIdx++;
                    }
                }
                normalized.push({ day: d, activities: order.map(k => byTime2.get(k)) });
            } else {
                // pad missing day with cycled interests
                const activities = order.map(k => {
                    const tag = tags.length ? tags[padIdx % tags.length] : 'interest';
                    padIdx++;
                    return { title: `[${tag}]`, description: null, time: k };
                });
                normalized.push({ day: d, activities });
            }
        }
        itinerary = normalized;

        const payload = {
            reply: language === 'ar' ? 'تم إنشاء الخطة.' : 'Plan generated.',
            meta: { destination, startDate, endDate, interests: preferences },
            itinerary
        };
        res.json(payload);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: { message: error.message } });
    }
});

// Photos API
router.get("/photos/:destination", async (req, res) => {
    try {
        const { destination } = req.params;
        const unsplashUrl = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(destination)}&per_page=12&orientation=landscape`;
        const response = await axios.get(unsplashUrl, { headers: { 'Authorization': `Client-ID ${UNSPLASH_API_KEY}` } });
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
        res.json({ destination, photos, total: photos.length });
    } catch (error) {
        console.error('Unsplash API Error:', error.response?.data || error.message);
        res.status(500).json({ error: { message: 'Failed to fetch photos' } });
    }
});

// Save Itinerary
router.post("/save-itinerary", async (req, res) => {
    try {
        const { itinerary, destination, startDate, endDate, preferences, language } = req.body;
        const id = uuidv4();
        const savedItinerary = { id, itinerary, destination, startDate, endDate, preferences, language, createdAt: new Date().toISOString(), views: 0 };
        savedItineraries.set(id, savedItinerary);
        res.json({ id, shareUrl: `${req.protocol}://${req.get('host')}/shared/${id}`, message: language === 'ar' ? 'تم حفظ الخطة بنجاح' : 'Itinerary saved successfully' });
    } catch (error) {
        res.status(500).json({ error: { message: error.message } });
    }
});

// Get Shared Itinerary
router.get("/shared/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const itinerary = savedItineraries.get(id);
        if (!itinerary) return res.status(404).json({ error: { message: 'Itinerary not found' } });
        itinerary.views += 1; savedItineraries.set(id, itinerary);
        res.json(itinerary);
    } catch (error) {
        res.status(500).json({ error: { message: error.message } });
    }
});

// AI Assistant
router.post("/ai-assistant", async (req, res) => {
    try {
        const { message, language = 'en', context = {} } = req.body;
        if (!API_KEY) return res.status(503).json({ error: { message: language === 'ar' ? 'خدمة الذكاء الاصطناعي غير متوفرة حالياً' : 'AI service is currently unavailable', code: 'AI_SERVICE_UNAVAILABLE' } });
        if (!message) return res.status(400).json({ error: { message: language === 'ar' ? 'الرسالة مطلوبة' : 'Message is required' } });
        const prompt = `You are a helpful travel assistant. ${language === 'ar' ? 'أجب باللغة العربية' : 'Respond in English'}\nUser question: ${message}\nContext: ${JSON.stringify(context)}\nProvide helpful, accurate travel advice. Keep responses concise and practical.`;
        const response = await axios.post(API_URL, { model: MODEL, messages: [{ role: 'user', content: prompt }] }, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}`, 'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000', 'X-Title': 'ai-travel-assistant' }, timeout: 15000 });
        const reply = response.data?.choices?.[0]?.message?.content || '';
        res.json({ response: reply, timestamp: new Date().toISOString(), provider: 'openrouter' });
    } catch (error) {
        console.error('AI Assistant Error:', error.response?.data || error.message);
        const { language = 'en' } = req.body;
        if (error.response?.status === 401) {
            res.status(503).json({ error: { message: language === 'ar' ? 'خدمة الذكاء الاصطناعي غير متوفرة حالياً' : 'AI service authentication failed', code: 'AI_AUTH_FAILED' } });
        } else {
            res.status(500).json({ error: { message: language === 'ar' ? 'حدث خطأ في خدمة الذكاء الاصطناعي' : 'AI service error', details: error.message } });
        }
    }
});

// Itinerary Chat (returns same strict shape when possible)
router.post('/itinerary-chat', async (req, res) => {
    try {
        const { chatId, message, language = 'en' } = req.body;
        if (!API_KEY) return res.status(503).json({ error: { message: 'AI service is currently unavailable' } });
        if (!message || typeof message !== 'string') return res.status(400).json({ error: { message: 'Message is required' } });

        const id = chatId || uuidv4();
        const session = chatSessions.get(id) || { history: [], itinerary: null, meta: { destination: '', startDate: '', endDate: '', interests: [] }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };

        const isArabic = language === 'ar';
        const system = (
            isArabic
            ? `أنت مخطط رحلات عبر الدردشة. التزم بالاختصار. انسخ الاهتمامات كما يذكرها المستخدم دون ترجمة أو إضافة.
عندما تكتمل المعلومات، أنشئ خطة يومية. القواعد:
- ثلاث فترات لكل يوم: "Morning", "Midday", "End of day".
- عنوان كل نشاط يجب أن يكون وسم الاهتمام بين أقواس مربعة فقط مثل: [food].
- الوصف قصير ومفيد (50-80 حرفاً) لكل نشاط.
- غطِّ جميع الاهتمامات مرة واحدة على الأقل إن أمكن.
أعد JSON فقط بالشكل التالي ولا تضع نصاً خارجه:
{"reply": "نص موجز", "meta": {"destination": string, "startDate": string, "endDate": string, "interests": string[]}, "itinerary": [{"day": number, "activities": [{"title": "[interest]", "description": "short description", "time": "Morning"}, {"title": "[interest]", "description": "short description", "time": "Midday"}, {"title": "[interest]", "description": "short description", "time": "End of day"}]}]}`
            : `You are a chat-based trip planner. Be concise. Copy interest tags exactly; do not translate or add new ones.
When enough info exists, build a plan with exactly these slots per day: "Morning", "Midday", "End of day". Each activity title must be exactly one bracketed interest like "[food]". Add a short, useful description (50–80 chars) for each activity. Cover all interests at least once if possible.
Return JSON only in this shape and nothing else:
{"reply": "Brief text", "meta": {"destination": string, "startDate": string, "endDate": string, "interests": string[]}, "itinerary": [{"day": number, "activities": [{"title": "[interest]", "description": "short description", "time": "Morning"}, {"title": "[interest]", "description": "short description", "time": "Midday"}, {"title": "[interest]", "description": "short description", "time": "End of day"}]}]}`
        );

        const messages = [ { role: 'system', content: system }, ...session.history, { role: 'user', content: message } ];
        const response = await axios.post(API_URL, { model: MODEL, messages }, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}`, 'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000', 'X-Title': 'itinerary-chat' }, timeout: 30000 });

        const content = response.data?.choices?.[0]?.message?.content || '';
        let payload;
        try { payload = JSON.parse(content); } catch { const m = content.match(/\{[\s\S]*\}/); if (m) { try { payload = JSON.parse(m[0]); } catch {} } }

        let replyText = ''; let itinerary = null; let meta = session.meta;
        if (payload && typeof payload === 'object') {
            if (typeof payload.reply === 'string') replyText = payload.reply;
            if (payload.meta && typeof payload.meta === 'object') {
                meta = { destination: payload.meta.destination || meta.destination || '', startDate: payload.meta.startDate || meta.startDate || '', endDate: payload.meta.endDate || meta.endDate || '', interests: Array.isArray(meta.interests) ? meta.interests : [] };
            }
            if (Array.isArray(payload.itinerary)) {
                const interestsSet = new Set((session.meta.interests || []).map(s => s.trim()));
                itinerary = payload.itinerary.map(day => ({
                    day: Number(day.day) || 1,
                    activities: Array.isArray(day.activities) ? day.activities.map(a => {
                        let title = String(a.title || '').trim(); const m = title.match(/\[(.*?)\]/); let tag = m ? m[1].trim() : '';
                        if (!tag && interestsSet.size) { for (const i of interestsSet) { if (title.toLowerCase().includes(i.toLowerCase())) { tag = i; break; } } }
                        if (tag) title = `[${tag}]`;
                        let time = a.time; const t = (time || '').toString().toLowerCase();
                        if (t.includes('morning') || t.includes('صباح')) time = 'Morning';
                        else if (t.includes('midday') || t.includes('منتصف') || t.includes('ظهر')) time = 'Midday';
                        else if (t.includes('end of day') || t.includes('مساء') || t.includes('ليل')) time = 'End of day';
                        const description = (typeof a.description === 'string') ? a.description.trim() : '';
                        return { title, description, time };
                    }) : []
                })).map(day => {
                    const order = ['Morning','Midday','End of day'];
                    const byTime = new Map();
                    for (const a of day.activities) { if (!byTime.has(a.time) && order.includes(a.time)) byTime.set(a.time, a); }
                    const missing = order.filter(k => !byTime.has(k));
                    if (missing.length) {
                        const tags = Array.from(interestsSet); let idx = 0;
                        for (const k of missing) { const tag = tags.length ? tags[idx % tags.length] : 'interest'; byTime.set(k, { title: `[${tag}]`, description: null, time: k }); idx++; }
                    }
                    return { day: day.day, activities: order.map(k => byTime.get(k)).filter(Boolean) };
                });
            }
        }

        if (!replyText) replyText = isArabic ? 'يرجى توضيح الرسالة.' : 'Please clarify your request.';

        session.history.push({ role: 'user', content: message });
        session.history.push({ role: 'assistant', content: replyText });
        session.meta = meta; if (itinerary) session.itinerary = itinerary; session.updatedAt = new Date().toISOString();
        chatSessions.set(id, session);

        res.json({ chatId: id, reply: replyText, meta, itinerary: session.itinerary || null });
    } catch (error) {
        console.error('Itinerary Chat Error:', error.response?.data || error.message);
        res.status(500).json({ error: { message: 'Chat service error' } });
    }
});

// Authenticated, persistent chat tied to an itinerary
router.post('/itineraries/:id/chat', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { message, language = 'en' } = req.body;
        if (!message || typeof message !== 'string') return res.status(400).json({ error: { message: 'Message is required' } });

        const it = await getAsync('SELECT * FROM itineraries WHERE id = ? AND user_id = ?', [id, req.session.userId]);
        if (!it) return res.status(404).json({ error: { message: 'Itinerary not found' } });

        // Load full chat history
        const history = await allAsync('SELECT role, content FROM messages WHERE itinerary_id = ? ORDER BY id ASC', [id]);

        const isArabic = (language || it.language) === 'ar';
        const system = (
            isArabic
            ? `أنت مخطط رحلات عبر الدردشة. التزم بالاختصار. انسخ الاهتمامات كما يذكرها المستخدم دون ترجمة أو إضافة.
عندما تكتمل المعلومات، أنشئ خطة يومية. القواعد:
- ثلاث فترات لكل يوم: "Morning", "Midday", "End of day".
- عنوان كل نشاط يجب أن يكون وسم الاهتمام بين أقواس مربعة فقط مثل: [food].
- الوصف يجب أن يكون null.
- غطِّ جميع الاهتمامات مرة واحدة على الأقل إن أمكن.
أعد JSON فقط بالشكل التالي ولا تضع نصاً خارجه:
{"reply": "نص موجز", "meta": {"destination": string, "startDate": string, "endDate": string, "interests": string[]}, "itinerary": [{"day": number, "activities": [{"title": "[interest]", "description": null, "time": "Morning"}, {"title": "[interest]", "description": null, "time": "Midday"}, {"title": "[interest]", "description": null, "time": "End of day"}]}]}`
            : `You are a chat-based trip planner. Be concise. Copy interest tags exactly; do not translate or add new ones.
When enough info exists, build a plan with exactly these slots per day: "Morning", "Midday", "End of day". Each activity title must be exactly one bracketed interest like "[food]". description must be null. Cover all interests at least once if possible.
Return JSON only in this shape and nothing else:
{"reply": "Brief text", "meta": {"destination": string, "startDate": string, "endDate": string, "interests": string[]}, "itinerary": [{"day": number, "activities": [{"title": "[interest]", "description": null, "time": "Morning"}, {"title": "[interest]", "description": null, "time": "Midday"}, {"title": "[interest]", "description": null, "time": "End of day"}]}]}`
        );

        const messages = [ { role: 'system', content: system }, ...history, { role: 'user', content: message } ];

        // Persist user message first
        await runAsync('INSERT INTO messages (itinerary_id, role, content, created_at) VALUES (?,?,?,?)', [id, 'user', message, new Date().toISOString()]);

        if (!API_KEY) return res.status(503).json({ error: { message: 'AI service is currently unavailable' } });
        const response = await axios.post(API_URL, { model: MODEL, messages }, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}`, 'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000', 'X-Title': 'itinerary-chat-persisted' }, timeout: 30000 });

        const content = response.data?.choices?.[0]?.message?.content || '';
        let payload;
        try { payload = JSON.parse(content); } catch { const m = content.match(/\{[\s\S]*\}/); if (m) { try { payload = JSON.parse(m[0]); } catch {} } }

        let replyText = '';
        let itineraryPlan = null;
        if (payload && typeof payload === 'object') {
            if (typeof payload.reply === 'string') replyText = payload.reply;
            if (Array.isArray(payload.itinerary)) {
                itineraryPlan = payload;
            }
        }
        if (!replyText) replyText = isArabic ? 'تم التحديث.' : 'Updated.';

        // Persist assistant reply
        await runAsync('INSERT INTO messages (itinerary_id, role, content, created_at) VALUES (?,?,?,?)', [id, 'assistant', replyText, new Date().toISOString()]);

        // Persist latest structured plan
        if (itineraryPlan) {
            const now = new Date().toISOString();
            await runAsync('UPDATE itineraries SET plan_json = ?, language = ?, updated_at = ? WHERE id = ?', [JSON.stringify(itineraryPlan), language || it.language, now, id]);
            // Versioning: next version number
            const v = await getAsync('SELECT MAX(version_number) as maxv FROM itinerary_versions WHERE itinerary_id = ?', [id]);
            const nextV = (v && v.maxv ? Number(v.maxv) : 0) + 1;
            await runAsync('INSERT INTO itinerary_versions (itinerary_id, version_number, plan_json, created_at) VALUES (?,?,?,?)', [id, nextV, JSON.stringify(itineraryPlan), now]);
        }

        const msgs = await allAsync('SELECT id, role, content, created_at as createdAt FROM messages WHERE itinerary_id = ? ORDER BY id ASC', [id]);
        const updated = await getAsync('SELECT plan_json FROM itineraries WHERE id = ?', [id]);
        res.json({ reply: replyText, messages: msgs, plan: updated?.plan_json ? JSON.parse(updated.plan_json) : null });
    } catch (error) {
        console.error('Itinerary Persisted Chat Error:', error.response?.data || error.message);
        res.status(500).json({ error: { message: 'Chat service error' } });
    }
});

// Versions API
router.get('/itineraries/:id/versions', requireAuth, async (req, res) => {
    try {
        const it = await getAsync('SELECT id FROM itineraries WHERE id = ? AND user_id = ?', [req.params.id, req.session.userId]);
        if (!it) return res.status(404).json({ error: { message: 'Not found' } });
        const rows = await allAsync('SELECT id, version_number as version, created_at as createdAt FROM itinerary_versions WHERE itinerary_id = ? ORDER BY version_number ASC', [req.params.id]);
        res.json({ versions: rows });
    } catch (err) {
        res.status(500).json({ error: { message: err.message } });
    }
});

// Mount router
app.use('/api', router);

// Health
app.get("/api/health", (req, res) => {
    res.json({ status: "healthy", timestamp: new Date().toISOString(), uptime: process.uptime(), version: "2.0.0", features: ["AI Itinerary Generation","Photo Galleries","Itinerary Sharing","AI Travel Assistant"] });
});

// Pretty route for auth page
app.get(['/auth', '/login', '/register'], (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'auth.html'));
});

app.listen(PORT, () => {
    console.log(`✅ Server running at http://localhost:${PORT}`);
    console.log(`📝 API:`);
    console.log(`   POST /api/generate-itinerary`);
    console.log(`   POST /api/itinerary-chat`);
    console.log(`   GET  /api/photos/:destination`);
    console.log(`   POST /api/save-itinerary`);
    console.log(`   GET  /api/shared/:id`);
    console.log(`   POST /api/ai-assistant`);
    console.log(`   GET  /api/health`);
});
