const express = require('express');
const db = require('../db/database');
const router = express.Router();

// ============ GET /api/items — View all items ============
router.get('/api/items', (req, res) => {
    try {
        const items = db.query(`
            SELECT id, title, description, image_filename, location_found, date_found, status
            FROM found_items
            ORDER BY created_at DESC
        `);

        res.json(items);
    } catch (err) {
        console.error('Error fetching items:', err);
        res.status(500).json({ error: 'Failed to load items.' });
    }
});

// ============ GET /api/items/:id — View single item ============
router.get('/api/items/:id', (req, res) => {
    try {
        const item = db.queryOne('SELECT * FROM found_items WHERE id = ?', [req.params.id]);
        
        if (!item) {
            return res.status(404).json({ error: 'Item not found.' });
        }
        
        res.json(item);
    } catch (err) {
        console.error('Error fetching item:', err);
        res.status(500).json({ error: 'Failed to load item.' });
    }
});

// ============ POST /api/items/:id/claim — Student claims an item ============
router.post('/api/items/:id/claim', (req, res) => {
    try {
        const { claimant_name, claimant_contact, pickup_date, message } = req.body;

        // Validation
        if (!claimant_name || !pickup_date) {
            return res.status(400).json({ error: 'Name and pickup date are required.' });
        }

        if (claimant_name.trim().length < 2) {
            return res.status(400).json({ error: 'Name must be at least 2 characters.' });
        }

        const item = db.queryOne('SELECT * FROM found_items WHERE id = ?', [req.params.id]);
        
        if (!item) {
            return res.status(404).json({ error: 'Item not found.' });
        }

        if (item.status === 'returned') {
            return res.status(400).json({ error: 'This item has already been returned.' });
        }

        // Check if student already has pending claim
        const existingClaim = db.queryOne(
            'SELECT id FROM claims WHERE item_id = ? AND claimant_name = ? AND status = ?',
            [item.id, claimant_name.trim(), 'pending']
        );

        if (existingClaim) {
            return res.status(400).json({ error: 'You already have a pending claim for this item.' });
        }

        const claimId = db.execute(
            `INSERT INTO claims (item_id, claimant_name, claimant_contact, pickup_date, message)
             VALUES (?, ?, ?, ?, ?)`,
            [
                item.id,
                claimant_name.trim(),
                claimant_contact ? claimant_contact.trim() : '',
                pickup_date,
                message ? message.trim() : ''
            ]
        );

        res.status(201).json({
            success: true,
            claimId: claimId,
            message: 'Claim submitted! Wait for admin approval.'
        });
    } catch (err) {
        console.error('Error submitting claim:', err);
        res.status(500).json({ error: 'Failed to submit claim.' });
    }
});

module.exports = router;