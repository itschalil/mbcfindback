const express = require('express');
const db = require('../db/database');
const upload = require('../middleware/upload');
const { requireAdmin } = require('../middleware/auth');
const fs = require('fs');
const path = require('path');
const router = express.Router();

// ALL admin routes need login
router.use(requireAdmin);

// ============ POST /api/admin/items — Upload new found item ============
router.post('/api/admin/items', upload.single('image'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Image is required.' });
        }

        const { title, description, location_found, date_found } = req.body;

        if (!title || !date_found) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ error: 'Title and date found are required.' });
        }

        const itemId = db.execute(
            `INSERT INTO found_items (title, description, image_filename, location_found, date_found)
             VALUES (?, ?, ?, ?, ?)`,
            [
                title.trim(),
                description ? description.trim() : '',
                req.file.filename,
                location_found ? location_found.trim() : '',
                date_found
            ]
        );

        res.status(201).json({
            success: true,
            id: itemId,
            message: 'Item uploaded successfully!'
        });
    } catch (err) {
        console.error('Error uploading item:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ============ GET /api/admin/items — Get all items ============
router.get('/api/admin/items', (req, res) => {
    try {
        const items = db.query(`
            SELECT fi.*, 
                (SELECT COUNT(*) FROM claims WHERE item_id = fi.id AND status = 'pending') as pending_claims
            FROM found_items fi
            ORDER BY fi.created_at DESC
        `);

        res.json(items);
    } catch (err) {
        console.error('Error fetching admin items:', err);
        res.status(500).json({ error: 'Failed to load items.' });
    }
});

// ============ GET /api/admin/claims — Get all claims ============
router.get('/api/admin/claims', (req, res) => {
    try {
        const claims = db.query(`
            SELECT c.*, fi.title as item_title, fi.image_filename
            FROM claims c
            JOIN found_items fi ON c.item_id = fi.id
            ORDER BY 
                CASE c.status WHEN 'pending' THEN 1 WHEN 'approved' THEN 2 ELSE 3 END,
                c.created_at DESC
        `);

        res.json(claims);
    } catch (err) {
        console.error('Error fetching claims:', err);
        res.status(500).json({ error: 'Failed to load claims.' });
    }
});

// ============ PATCH /api/admin/claims/:id — Approve/Reject claim ============
router.patch('/api/admin/claims/:id', (req, res) => {
    try {
        const { status } = req.body;

        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status.' });
        }

        const claim = db.queryOne('SELECT * FROM claims WHERE id = ?', [req.params.id]);
        
        if (!claim) {
            return res.status(404).json({ error: 'Claim not found.' });
        }

        // Update claim status
        db.execute('UPDATE claims SET status = ? WHERE id = ?', [status, claim.id]);

        // If approved, mark item as claimed
        if (status === 'approved') {
            db.execute('UPDATE found_items SET status = ? WHERE id = ?', ['claimed', claim.item_id]);

            // Reject other pending claims for same item
            db.execute(
                `UPDATE claims SET status = 'rejected' 
                 WHERE item_id = ? AND id != ? AND status = 'pending'`,
                [claim.item_id, claim.id]
            );
        }

        res.json({ success: true, message: `Claim ${status}.` });
    } catch (err) {
        console.error('Error updating claim:', err);
        res.status(500).json({ error: 'Failed to update claim.' });
    }
});

// ============ PATCH /api/admin/items/:id/returned — Mark as returned ============
router.patch('/api/admin/items/:id/returned', (req, res) => {
    try {
        const item = db.queryOne('SELECT * FROM found_items WHERE id = ?', [req.params.id]);
        
        if (!item) {
            return res.status(404).json({ error: 'Item not found.' });
        }

        db.execute('UPDATE found_items SET status = ? WHERE id = ?', ['returned', item.id]);
        res.json({ success: true, message: 'Item marked as returned.' });
    } catch (err) {
        console.error('Error marking item as returned:', err);
        res.status(500).json({ error: 'Failed to update item.' });
    }
});

// ============ DELETE /api/admin/items/:id — Delete item ============
router.delete('/api/admin/items/:id', (req, res) => {
    try {
        const item = db.queryOne('SELECT * FROM found_items WHERE id = ?', [req.params.id]);
        
        if (!item) {
            return res.status(404).json({ error: 'Item not found.' });
        }

        // Delete image file
        const imagePath = path.join(__dirname, '..', 'uploads', item.image_filename);
        if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
        }

        db.execute('DELETE FROM found_items WHERE id = ?', [item.id]);
        res.json({ success: true, message: 'Item deleted.' });
    } catch (err) {
        console.error('Error deleting item:', err);
        res.status(500).json({ error: 'Failed to delete item.' });
    }
});

module.exports = router;