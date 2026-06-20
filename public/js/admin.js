// ============ AUTH CHECK ============
(async () => {
    const res = await fetch('/api/check-auth');
    const data = await res.json();
    if (!data.isAdmin) {
        window.location.href = '/login.html';
    }
})();

// ============ LOGOUT ============
document.getElementById('logoutBtn').addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/login.html';
});

// ============ TABS ============
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');

        if (tab.dataset.tab === 'items') loadAdminItems();
        if (tab.dataset.tab === 'claims') loadClaims();
    });
});

// ============ IMAGE PREVIEW ============
document.getElementById('itemImage').addEventListener('change', (e) => {
    const preview = document.getElementById('imagePreview');
    if (e.target.files[0]) {
        preview.src = URL.createObjectURL(e.target.files[0]);
        preview.style.display = 'block';
    }
});

// ============ UPLOAD ITEM ============
document.getElementById('uploadForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msgEl = document.getElementById('uploadMsg');
    const formData = new FormData();

    formData.append('title', document.getElementById('itemTitle').value.trim());
    formData.append('description', document.getElementById('itemDesc').value.trim());
    formData.append('location_found', document.getElementById('itemLocation').value.trim());
    formData.append('date_found', document.getElementById('itemDate').value);
    formData.append('image', document.getElementById('itemImage').files[0]);

    try {
        const res = await fetch('/api/admin/items', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        msgEl.style.color = res.ok ? 'green' : 'red';
        msgEl.textContent = data.message || data.error;

        if (res.ok) {
            e.target.reset();
            document.getElementById('imagePreview').style.display = 'none';
        }
    } catch (err) {
        msgEl.style.color = 'red';
        msgEl.textContent = 'Upload failed.';
    }
});

// ============ ESCAPE HTML ============
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ============ LOAD ITEMS ============
async function loadAdminItems() {
    try {
        const res = await fetch('/api/admin/items');
        const items = await res.json();
        const container = document.getElementById('adminItemsList');

        if (items.length === 0) {
            container.innerHTML = '<p>No items yet.</p>';
            return;
        }

        container.innerHTML = items.map(item => `
            <div class="admin-item">
                <img src="/uploads/${item.image_filename}" alt="${escapeHtml(item.title)}" style="width:100px; height:100px; object-fit:cover; border-radius:4px;">
                <div style="flex:1;">
                    <h3>${escapeHtml(item.title)}</h3>
                    <p>Status: <strong class="status-badge status-${item.status}">${item.status.toUpperCase()}</strong> | Pending Claims: ${item.pending_claims}</p>
                    <p>Date Found: ${item.date_found}</p>
                    <div class="item-actions">
                        ${item.status === 'claimed' ? 
                            `<button class="mark-returned-btn" data-id="${item.id}">✅ Mark Returned</button>` : ''}
                        <button class="delete-btn" data-id="${item.id}">🗑️ Delete</button>
                    </div>
                </div>
            </div>
        `).join('');

        // Add event listeners (NO inline onclick!)
        document.querySelectorAll('.mark-returned-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.getAttribute('data-id');
                markReturned(id);
            });
        });

        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.getAttribute('data-id');
                deleteItem(id);
            });
        });
    } catch (err) {
        console.error('Error loading items:', err);
        document.getElementById('adminItemsList').innerHTML = '<p style="color:red;">Error loading items.</p>';
    }
}

// ============ LOAD CLAIMS ============
async function loadClaims() {
    try {
        const res = await fetch('/api/admin/claims');
        const claims = await res.json();
        const container = document.getElementById('claimsList');

        if (claims.length === 0) {
            container.innerHTML = '<p>No claims yet.</p>';
            return;
        }

        container.innerHTML = claims.map(claim => `
            <div class="claim-card status-${claim.status}">
                <img src="/uploads/${claim.image_filename}" style="width:80px; height:80px; object-fit:cover; border-radius:4px;">
                <div style="flex:1;">
                    <h3>Item: ${escapeHtml(claim.item_title)}</h3>
                    <p><strong>Claimant:</strong> ${escapeHtml(claim.claimant_name)}</p>
                    <p><strong>Contact:</strong> ${escapeHtml(claim.claimant_contact || 'N/A')}</p>
                    <p><strong>Pickup Date:</strong> ${claim.pickup_date}</p>
                    <p><strong>Message:</strong> ${escapeHtml(claim.message || 'N/A')}</p>
                    <p><strong>Status:</strong> <span class="status-badge status-${claim.status}">${claim.status.toUpperCase()}</span></p>
                    ${claim.status === 'pending' ? `
                        <button class="approve-btn" data-id="${claim.id}" data-action="approved">✅ Approve</button>
                        <button class="reject-btn" data-id="${claim.id}" data-action="rejected">❌ Reject</button>
                    ` : ''}
                </div>
            </div>
        `).join('');

        // Add event listeners (NO inline onclick!)
        document.querySelectorAll('.approve-btn, .reject-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.getAttribute('data-id');
                const action = e.target.getAttribute('data-action');
                updateClaim(id, action);
            });
        });
    } catch (err) {
        console.error('Error loading claims:', err);
        document.getElementById('claimsList').innerHTML = '<p style="color:red;">Error loading claims.</p>';
    }
}

// ============ UPDATE CLAIM STATUS ============
async function updateClaim(id, status) {
    const actionWord = status === 'approved' ? 'Approve' : 'Reject';
    if (!confirm(`${actionWord} this claim?`)) {
        return;
    }

    try {
        const res = await fetch(`/api/admin/claims/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });

        const data = await res.json();
        
        if (res.ok) {
            alert(`✅ ${data.message}`);
            loadClaims();
            loadAdminItems();
        } else {
            alert('❌ Error: ' + (data.error || 'Unknown error'));
        }
    } catch (err) {
        console.error('Error updating claim:', err);
        alert('❌ Failed to update claim.');
    }
}

// ============ MARK RETURNED ============
async function markReturned(id) {
    if (!confirm('Mark this item as returned?')) return;
    
    try {
        const res = await fetch(`/api/admin/items/${id}/returned`, { 
            method: 'PATCH' 
        });
        
        if (res.ok) {
            alert('✅ Item marked as returned.');
            loadAdminItems();
        } else {
            const data = await res.json();
            alert('❌ Error: ' + data.error);
        }
    } catch (err) {
        console.error('Error:', err);
        alert('❌ Failed to update item.');
    }
}

// ============ DELETE ITEM ============
async function deleteItem(id) {
    if (!confirm('Delete this item permanently?')) return;
    
    try {
        const res = await fetch(`/api/admin/items/${id}`, { 
            method: 'DELETE' 
        });
        
        if (res.ok) {
            alert('✅ Item deleted.');
            loadAdminItems();
        } else {
            const data = await res.json();
            alert('❌ Error: ' + data.error);
        }
    } catch (err) {
        console.error('Error:', err);
        alert('❌ Failed to delete item.');
    }
}