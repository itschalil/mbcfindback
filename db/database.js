const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const usePostgreSQL = process.env.DATABASE_URL ? true : false;

let db = null;
let dbReady = false;

// ==========================================
// POSTGRESQL VERSION (FOR RENDER/PRODUCTION)
// ==========================================
if (usePostgreSQL) {
    const { Pool } = require('pg');
    
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    // MAGIC TRANSLATOR: Converts '?' to '$1, $2' for PostgreSQL
    function formatQuery(sql, params) {
        let index = 0;
        const formattedSql = sql.replace(/\?/g, () => `$${++index}`);
        return { sql: formattedSql, params };
    }

    async function query(sql, params = []) {
        const { sql: formattedSql, params: formattedParams } = formatQuery(sql, params);
        const result = await pool.query(formattedSql, formattedParams);
        return result.rows;
    }

    async function queryOne(sql, params = []) {
        const results = await query(sql, params);
        return results.length > 0 ? results[0] : null;
    }

    async function execute(sql, params = []) {
        const { sql: formattedSql, params: formattedParams } = formatQuery(sql, params);
        const result = await pool.query(formattedSql, formattedParams);
        return result.rows[0]?.id || result.rowCount || null;
    }

    async function initDatabase() {
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS admin (
                    id SERIAL PRIMARY KEY,
                    username TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            await pool.query(`
                CREATE TABLE IF NOT EXISTS found_items (
                    id SERIAL PRIMARY KEY,
                    title TEXT NOT NULL,
                    description TEXT,
                    image_filename TEXT NOT NULL,
                    location_found TEXT,
                    date_found TEXT NOT NULL,
                    status TEXT DEFAULT 'unclaimed' CHECK(status IN ('unclaimed', 'claimed', 'returned')),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            await pool.query(`
                CREATE TABLE IF NOT EXISTS claims (
                    id SERIAL PRIMARY KEY,
                    item_id INTEGER REFERENCES found_items(id) ON DELETE CASCADE,
                    claimant_name TEXT NOT NULL,
                    claimant_contact TEXT,
                    pickup_date TEXT NOT NULL,
                    message TEXT,
                    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            const existingAdmin = await queryOne('SELECT id FROM admin LIMIT 1');
            if (!existingAdmin) {
                const username = process.env.ADMIN_USERNAME || 'mbcfindbackadmin';
                const password = process.env.ADMIN_PASSWORD || '@weareOSA';
                const hash = bcrypt.hashSync(password, 10);
                await execute('INSERT INTO admin (username, password_hash) VALUES (?, ?) RETURNING id', [username, hash]);
                console.log(`✅ Default admin created: ${username}`);
            }

            dbReady = true;
            console.log('✅ PostgreSQL database initialized and ready');
        } catch (err) {
            console.error('❌ Database initialization error:', err);
            throw err;
        }
    }

    module.exports = { query, queryOne, execute, isReady: () => dbReady, initDatabase };
} 
// ==========================================
// SQL.JS VERSION (FOR LOCAL DEVELOPMENT)
// ==========================================
else {
    const initSqlJs = require('sql.js');
    const DB_PATH = path.join(__dirname, 'mbcfindback.db');

    function saveDatabase() {
        if (db) {
            const data = db.export();
            const buffer = Buffer.from(data);
            fs.writeFileSync(DB_PATH, buffer);
        }
    }

    function query(sql, params = []) {
        if (!db) return [];
        const stmt = db.prepare(sql);
        if (params.length > 0) stmt.bind(params);
        const results = [];
        while (stmt.step()) results.push(stmt.getAsObject());
        stmt.free();
        return results;
    }

    function queryOne(sql, params = []) {
        const results = query(sql, params);
        return results.length > 0 ? results[0] : null;
    }

    function execute(sql, params = []) {
        if (!db) return null;
        db.run(sql, params);
        saveDatabase();
        const result = queryOne('SELECT last_insert_rowid() as lastId');
        return result ? result.lastId : null;
    }

    async function initDatabase() {
        try {
            const SQL = await initSqlJs();
            if (fs.existsSync(DB_PATH)) {
                db = new SQL.Database(fs.readFileSync(DB_PATH));
            } else {
                db = new SQL.Database();
            }

            db.run(`CREATE TABLE IF NOT EXISTS admin (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
            db.run(`CREATE TABLE IF NOT EXISTS found_items (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, description TEXT, image_filename TEXT NOT NULL, location_found TEXT, date_found TEXT NOT NULL, status TEXT DEFAULT 'unclaimed', created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
            db.run(`CREATE TABLE IF NOT EXISTS claims (id INTEGER PRIMARY KEY AUTOINCREMENT, item_id INTEGER NOT NULL, claimant_name TEXT NOT NULL, claimant_contact TEXT, pickup_date TEXT NOT NULL, message TEXT, status TEXT DEFAULT 'pending', created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);

            saveDatabase();

            const existingAdmin = queryOne('SELECT id FROM admin LIMIT 1');
            if (!existingAdmin) {
                const username = process.env.ADMIN_USERNAME || 'mbcfindbackadmin';
                const password = process.env.ADMIN_PASSWORD || '@weareOSA';
                const hash = bcrypt.hashSync(password, 10);
                execute('INSERT INTO admin (username, password_hash) VALUES (?, ?)', [username, hash]);
                console.log(`✅ Default admin created: ${username}`);
            }

            dbReady = true;
            console.log('✅ sql.js database initialized');
        } catch (err) {
            console.error('❌ Database error:', err.message);
        }
    }

    initDatabase();
    module.exports = { query, queryOne, execute, saveDatabase, isReady: () => dbReady };
}