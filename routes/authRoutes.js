const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const router = express.Router();

// POST /api/login
router.post('/api/login', (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required.' });
        }

        const admin = db.queryOne('SELECT * FROM admin WHERE username = ?', [username]);

        if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
            return res.status(401).json({ error: 'Invalid username or password.' });
        }

        // Set session
        req.session.isAdmin = true;
        req.session.adminId = admin.id;

        res.json({ success: true, message: 'Login successful' });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// POST /api/logout
router.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        res.json({ success: true });
    });
});

// GET /api/check-auth
router.get('/api/check-auth', (req, res) => {
    res.json({ isAdmin: !!(req.session && req.session.isAdmin) });
});

module.exports = router;