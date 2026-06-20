const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

// Secure storage: random filename, specific folder
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '..', 'uploads'));
    },
    filename: function (req, file, cb) {
        // Random name para walang conflict + hindi ma-guess
        const uniqueName = crypto.randomBytes(16).toString('hex');
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, uniqueName + ext);
    }
});

// File filter: IMAGES ONLY (security!)
const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Only JPEG, PNG, GIF, and WebP images are allowed!'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB max lang
    }
});

module.exports = upload;