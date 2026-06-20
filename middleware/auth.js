function requireAdmin(req, res, next) {
    if (req.session && req.session.isAdmin) {
        return next();
    }
    // Kung API request, return JSON
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
        return res.status(401).json({ error: 'Unauthorized. Please login first.' });
    }
    res.redirect('/login.html');
}

module.exports = { requireAdmin };