require('dotenv').config();
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Import routes
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const studentRoutes = require('./routes/studentRoutes');
const db = require('./db/database');

const app = express();
const PORT = process.env.PORT || 3000;

// ============ SECURITY MIDDLEWARE ============
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "blob:"],
            connectSrc: ["'self'"]
        }
    }
}));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10000,  // ← Pinalaki ko para hindi ka ma-block
    message: { error: 'Too many requests, please try again later.' }
});
app.use(limiter);

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,  // ← Pinalaki ko rin
    message: { error: 'Too many login attempts. Try again in 15 minutes.' }
});

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session
app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback_secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 8 * 60 * 60 * 1000,
        httpOnly: true,
        secure: false,
        sameSite: 'strict'
    }
}));

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ============ ROUTES ============
app.use('/api/login', loginLimiter);
app.use(authRoutes);
app.use(adminRoutes);
app.use(studentRoutes);

// Fallback
app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'Route not found.' });
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============ WAIT FOR DATABASE THEN START SERVER ============
function waitForDatabase() {
    return new Promise((resolve) => {
        const check = () => {
            try {
                db.exec('SELECT 1');
                resolve();
            } catch (err) {
                setTimeout(check, 100);
            }
        };
        check();
    });
}

// ============ WAIT FOR DATABASE THEN START SERVER ============
(async () => {
    // Initialize database first
    await db.initDatabase();
    
    app.listen(PORT, () => {
        console.log(`🚀 MBCFindBack running at http://localhost:${PORT}`);
        console.log(`📋 Student View: http://localhost:${PORT}/`);
        console.log(` Admin Panel: http://localhost:${PORT}/admin.html`);
        console.log(`🔑 Login: http://localhost:${PORT}/login.html`);
    });
})();