// FORCE RESET - Delete ALL admins and create fresh one
await pool.query('DELETE FROM admin');

const username = process.env.ADMIN_USERNAME || 'mbcadmin';
const password = process.env.ADMIN_PASSWORD || '@weareOSA';
const hash = bcrypt.hashSync(password, 10);

await execute('INSERT INTO admin (username, password_hash) VALUES (?, ?)', [username, hash]);
console.log(`✅ Admin RESET: ${username} / ${password}`);