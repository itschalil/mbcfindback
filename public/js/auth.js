document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorMsg = document.getElementById('errorMsg');
    errorMsg.textContent = '';

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await res.json();

        if (res.ok) {
            window.location.href = '/admin.html';
        } else {
            errorMsg.textContent = data.error || 'Login failed.';
        }
    } catch (err) {
        errorMsg.textContent = 'Network error. Try again.';
    }
});

// Check if already logged in
(async () => {
    try {
        const res = await fetch('/api/check-auth');
        const data = await res.json();
        if (data.isAdmin) {
            window.location.href = '/admin.html';
        }
    } catch (err) {}
})();