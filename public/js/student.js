let allItems = [];

// ============ ESCAPE HTML (Security) ============
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ============ LOAD ITEMS ============
async function loadItems() {
    try {
        console.log('Loading items...');
        const res = await fetch('/api/items');
        console.log('Response status:', res.status);

        allItems = await res.json();
        console.log('Items loaded:', allItems);

        renderItems(allItems);
    } catch (err) {
        console.error('Error loading items:', err);
        document.getElementById('itemsGrid').innerHTML =
            '<p style="color: red;">Error loading items. Please refresh.</p>';
    }
}

// ============ RENDER ITEMS ============
function renderItems(items) {
    const grid = document.getElementById('itemsGrid');
    console.log('Rendering items:', items.length);

    if (items.length === 0) {
        grid.innerHTML = '<p>No items found. Check back later!</p>';
        return;
    }

    grid.innerHTML = items.map(item => `
        <div class="item-card" data-status="${item.status}" data-id="${item.id}">
            <img src="/uploads/${item.image_filename}" alt="${escapeHtml(item.title)}"
                 onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%2250%25%22 x=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 font-size=%2240%22>📷</text></svg>'">
            <div class="item-info">
                <h3>${escapeHtml(item.title)}</h3>
                <p>${escapeHtml(item.description || '')}</p>
                <p><strong>📍 Found at:</strong> ${escapeHtml(item.location_found || 'N/A')}</p>
                <p><strong> Date Found:</strong> ${escapeHtml(item.date_found)}</p>
                <span class="status-badge status-${item.status}">${item.status.toUpperCase()}</span>
                ${item.status === 'unclaimed' ?
                    `<button class="claim-btn" data-item-id="${item.id}">🙋 Claim This</button>` :
                    ''}
            </div>
        </div>
    `).join('');

    // Add event listeners to claim buttons
    document.querySelectorAll('.claim-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const itemId = e.target.getAttribute('data-item-id');
            openClaimModal(itemId);
        });
    });
}

// ============ SEARCH & FILTER ============
document.getElementById('searchInput').addEventListener('input', filterItems);
document.getElementById('statusFilter').addEventListener('change', filterItems);

function filterItems() {
    const search = document.getElementById('searchInput').value.toLowerCase();
    const status = document.getElementById('statusFilter').value;

    const filtered = allItems.filter(item => {
        const matchSearch = item.title.toLowerCase().includes(search) ||
                           (item.description || '').toLowerCase().includes(search) ||
                           (item.location_found || '').toLowerCase().includes(search);
        const matchStatus = status === 'all' || item.status === status;
        return matchSearch && matchStatus;
    });

    renderItems(filtered);
}

// ============ CLAIM MODAL ============
function openClaimModal(itemId) {
    console.log('Opening modal for item:', itemId);
    document.getElementById('claimItemId').value = itemId;
    document.getElementById('claimModal').style.display = 'flex';
    document.getElementById('pickupDate').min = new Date().toISOString().split('T')[0];
}

document.querySelector('.close-modal').addEventListener('click', () => {
    document.getElementById('claimModal').style.display = 'none';
    document.getElementById('claimForm').reset();
    document.getElementById('claimMsg').textContent = '';
});

document.getElementById('claimModal').addEventListener('click', (e) => {
    if (e.target.id === 'claimModal') {
        document.getElementById('claimModal').style.display = 'none';
        document.getElementById('claimForm').reset();
        document.getElementById('claimMsg').textContent = '';
    }
});

// ============ CLAIM FORM SUBMIT ============
document.getElementById('claimForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msgEl = document.getElementById('claimMsg');
    const itemId = document.getElementById('claimItemId').value;

    const body = {
        claimant_name: document.getElementById('claimantName').value.trim(),
        claimant_contact: document.getElementById('claimantContact').value.trim(),
        pickup_date: document.getElementById('pickupDate').value,
        message: document.getElementById('claimMessage').value.trim()
    };

    console.log('Submitting claim:', body);

    try {
        const res = await fetch(`/api/items/${itemId}/claim`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const data = await res.json();
        console.log('Response:', data);

        msgEl.style.color = res.ok ? 'green' : 'red';
        msgEl.textContent = data.message || data.error;

        if (res.ok) {
            setTimeout(() => {
                document.getElementById('claimModal').style.display = 'none';
                document.getElementById('claimForm').reset();
                document.getElementById('claimMsg').textContent = '';
                loadItems();
            }, 2000);
        }
    } catch (err) {
        console.error('Error:', err);
        msgEl.style.color = 'red';
        msgEl.textContent = 'Network error.';
    }
});

// ============ INIT — LOAD ITEMS ON PAGE LOAD ============
loadItems();