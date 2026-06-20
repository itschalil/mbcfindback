const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'mbcfindback.db');

let db = null;
let dbReady = false;

// Helper: Save database to file
function saveDatabase() {
    if (db) {
        const data = db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(DB_PATH, buffer);
    }
}

// Helper: Run query and return results
function query(sql, params = []) {
    const stmt = db.prepare(sql);
    if (params.length > 0) {
        stmt.bind(params);
    }
    
    const results = [];
    while (stmt.step()) {
        results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
}

// Helper: Run query and return first result
function queryOne(sql, params = []) {
    const results = query(sql, params);
    return results.length > 0 ? results[0] : null;
}

// Helper: Execute statement (INSERT/UPDATE/DELETE)
function execute(sql, params = []) {
    db.run(sql, params);
    saveDatabase();
    
    // Get last inserted ID
    const result = queryOne('SELECT last_insert_rowid() as lastId');
    return result ? result.lastId : null;
}

// Initialize database
async function initDatabase() {
    const SQL = await initSqlJs();
    
    // Load existing database or create new one
    if (fs.existsSync(DB_PATH)) {
        const fileBuffer = fs.readFileSync(DB_PATH);
        db = new SQL.Database(fileBuffer);
    } else {
        db = new SQL.Database();
    }

    // Create tables
    db.run(`
        CREATE TABLE IF NOT EXISTS admin (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS found_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            image_filename TEXT NOT NULL,
            location_found TEXT,
            date_found TEXT NOT NULL,
            status TEXT DEFAULT 'unclaimed' CHECK(status IN ('unclaimed', 'claimed', 'returned')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS claims (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_id INTEGER NOT NULL,
            claimant_name TEXT NOT NULL,
            claimant_contact TEXT,
            pickup_date TEXT NOT NULL,
            message TEXT,
            status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (item_id) REFERENCES found_items(id) ON DELETE CASCADE
        )
    `);

    saveDatabase();

    // Seed default admin
    const existingAdmin = queryOne('SELECT id FROM admin LIMIT 1');
    if (!existingAdmin) {
        const username = process.env.ADMIN_USERNAME || 'admin';
        const password = process.env.ADMIN_PASSWORD || 'admin123';
        const hash = bcrypt.hashSync(password, 10);
        execute('INSERT INTO admin (username, password_hash) VALUES (?, ?)', [username, hash]);
        console.log(`✅ Default admin created: ${username}`);
    }

    dbReady = true;
    console.log('✅ Database initialized and ready');
}

// Export database functions
module.exports = {
    query,
    queryOne,
    execute,
    saveDatabase,
    isReady: () => dbReady,
    initDatabase
};