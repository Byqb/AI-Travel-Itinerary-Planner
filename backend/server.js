const express = require("express");
const cors = require("cors");

const logger = require("./public/logger");
const errorHandler = require("./public/errorHandler");
const itineraryRoute = require("./public/itineraryRoute");
const healthRoute = require("./public/healthRoute");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static("public"));
app.use(logger);

app.use("/api", itineraryRoute);
app.use("/api", healthRoute);
app.use(errorHandler);

app.listen(PORT, () => {
    console.log(`✅ Server running at http://localhost:${PORT}`);
    console.log(`📝 API Documentation:`);
    console.log(`   POST /api/generate-itinerary - Generate travel itinerary`);
    console.log(`   GET /api/health - Check server health`);
});
