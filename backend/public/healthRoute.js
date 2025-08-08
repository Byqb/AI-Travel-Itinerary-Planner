const expressHealth = require("express");
const healthRouter = expressHealth.Router();

healthRouter.get("/health", (req, res) => {
    res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

module.exports = healthRouter;