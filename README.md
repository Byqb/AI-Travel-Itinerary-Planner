# 🚀 AI Travel Itinerary Planner v2.0

A powerful, feature-rich AI-powered travel planning application that helps users create personalized travel itineraries with comprehensive travel information and tools.

## ✨ Features

### 🧠 AI-Powered Itinerary Generation

- Generate detailed day-by-day travel plans using advanced AI
- Customizable based on preferences, dates, and interests
- Support for multiple languages (Arabic & English)

<!-- Removed features: Weather Integration, Budget Estimation -->

### 📸 Destination Photo Gallery

- Beautiful destination photos and galleries
- High-quality images with photographer credits
- Interactive photo viewer with modal display

<!-- Removed feature: Intelligent Packing Lists -->

<!-- Removed feature: Travel Tips & Advice -->

### 🔗 Share & Collaborate

- Save and share itineraries with unique URLs
- Social media integration (WhatsApp, Email, Twitter)
- Copy shareable links with one click

### 📄 Export & Documentation

- Export itineraries to PDF (coming soon)
- Travel document checklist
- Downloadable travel plans

### ⏰ Trip Countdown

- Real-time countdown to trip start
- Visual countdown display
- Automatic updates

### 🎨 Beautiful User Interface

- Modern glassmorphism design
- Dark/Light theme toggle
- Animated particle background
- Fully responsive mobile design
- RTL support for Arabic

### 🌍 Multilingual Support

- Full Arabic and English localization
- Easy language switching
- Culturally appropriate content

## 🛠️ Technology Stack

### Backend

- **Node.js** with Express.js framework
- **OpenRouter AI** for intelligent itinerary generation
- **Axios** for HTTP requests
- **CORS** for cross-origin requests
- **Compression** for response optimization
- **UUID** for unique identifier generation

### Frontend

- **Pure HTML5, CSS3, JavaScript** (no frameworks for maximum performance)
- **CSS Custom Properties** for theming
- **CSS Grid & Flexbox** for responsive layouts
- **Backdrop Filter** for glassmorphism effects
- **CSS Animations** for interactive elements

### APIs & Services

- OpenRouter AI (Gemini 2.0 Flash) for itinerary generation
- Unsplash API for destination photos (configurable)

## 📁 Project Structure

```
AI-Travel-Itinerary-Planner/
│
├── backend/
│   ├── package.json          # Dependencies and scripts
│   ├── server.js             # Main server file with all APIs
│   └── public/
│       ├── index.html        # Main frontend file
│       └── styles.css        # Complete styling
│
├── README.md                 # Project documentation
└── LICENSE                   # License file
```

## 🚀 Installation & Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/Byqb/AI-Travel-Itinerary-Planner.git
   cd AI-Travel-Itinerary-Planner
   ```

2. **Navigate to backend directory**

   ```bash
   cd backend
   ```

3. **Install dependencies**

   ```bash
   npm install
   ```

4. **Configure API Keys**
   Create a `.env` file in `backend/` and set:

   - `API_KEY` for OpenRouter
   - (Optional) `APP_URL`

5. **Start the server**

   ```bash
   npm start
   ```

6. **Open your browser**
   Navigate to `http://localhost:3000`

## 🔧 API Endpoints

### Core Features

- `POST /api/generate-itinerary` - Generate AI travel itinerary
- `GET /api/health` - Server health check

### Additional Features

- `GET /api/photos/:destination` - Destination photos
- `POST /api/save-itinerary` - Save and share itinerary
- `GET /api/shared/:id` - Retrieve shared itinerary

## 🎯 Usage

1. **Plan Your Trip**

   - Enter travel dates and destination
   - Choose your interests and preferences

2. **Generate Itinerary**

   - Click "Generate Plan" to create your AI-powered itinerary
   - View detailed day-by-day activities and recommendations

3. **Explore Additional Features**

   - Browse destination photo galleries

4. **Organize Your Trip**

   - Generate a comprehensive packing list
   - Monitor trip countdown timer
   - Access travel document checklist

5. **Share Your Plan**
   - Save your itinerary with a shareable link
   - Share via social media or direct messaging
   - Export to PDF for offline access

## 🌟 What's New in v2.0

- ✅ Interactive destination photo galleries
- ✅ Itinerary sharing and collaboration
- ✅ Trip countdown timer
- ✅ Enhanced mobile responsiveness
- ✅ Improved error handling and user feedback
- ✅ Performance optimizations

## 🔮 Coming Soon

- 📄 PDF export functionality
- 🗺️ Interactive map integration
- 📱 Progressive Web App (PWA) support
- 🏨 Hotel booking integration
- ✈️ Flight search and booking
- 🍽️ Restaurant recommendations and reservations
- 👥 User accounts and trip history
- 🔔 Push notifications for trip reminders
- 📊 Analytics and trip statistics

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Developer

**Developed by [@Byqb](https://github.com/Byqb)**

## 🔗 Links

- [GitHub Repository](https://github.com/Byqb/AI-Travel-Itinerary-Planner)
- [Live](https://ai-travel-itinerary-planner-6uh4.onrender.com/)

---

**Enjoy planning your next adventure with AI! ✈️🌍**
