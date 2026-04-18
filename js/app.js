document.addEventListener('DOMContentLoaded', () => {

    // ─────────────────────────────────────────
    //  AUTH STATE
    // ─────────────────────────────────────────
    let currentUser = null;
    try {
        const stored = localStorage.getItem('civic_user');
        if (stored) currentUser = JSON.parse(stored);
    } catch (e) { console.error('LocalStorage error:', e); }

    // ─────────────────────────────────────────
    //  NAV RENDERING
    // ─────────────────────────────────────────
    const navLinksContainer = document.getElementById('navLinks');

    function renderNavigation() {
        if (currentUser) {
            navLinksContainer.innerHTML = `
                <button class="nav-btn" data-tab="dashboard-tab">🏙 Dashboard</button>
                <button class="nav-btn" data-tab="report-tab">📝 Report Issue</button>
                <button class="nav-btn" data-tab="my-complaints-tab">📁 My Issues</button>
                <button class="nav-btn" data-tab="profile-tab">👤 Profile</button>
                <button class="nav-btn" id="logoutBtn" style="color:var(--danger)">Logout</button>
            `;
            document.getElementById('logoutBtn').addEventListener('click', () => {
                localStorage.removeItem('civic_user');
                currentUser = null;
                clearPolling();
                renderNavigation();
                switchTab('login-tab');
            });
        } else {
            navLinksContainer.innerHTML = `
                <button class="nav-btn" data-tab="dashboard-tab">🏙 Dashboard</button>
                <button class="nav-btn" data-tab="login-tab">Log In</button>
                <button class="nav-btn" data-tab="register-tab">Register</button>
            `;
        }
        setupTabListeners();
    }

    // ─────────────────────────────────────────
    //  TAB SWITCHING
    // ─────────────────────────────────────────
    // ─────────────────────────────────────────
    //  MOBILE NAVIGATION
    // ─────────────────────────────────────────
    const mobileToggle = document.getElementById('mobileToggle');
    const navLinks = document.getElementById('navLinks');

    if (mobileToggle) {
        mobileToggle.addEventListener('click', () => {
            navLinks.classList.toggle('show');
            mobileToggle.textContent = navLinks.classList.contains('show') ? '✕' : '☰';
        });
    }

    function closeMobileNav() {
        if (navLinks.classList.contains('show')) {
            navLinks.classList.remove('show');
            mobileToggle.textContent = '☰';
        }
    }

    function switchTab(tabId) {
        document.querySelectorAll('.nav-btn, .nav-link-inline').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));

        const btn = document.querySelector(`.nav-btn[data-tab="${tabId}"]`);
        if (btn) btn.classList.add('active');
        const tab = document.getElementById(tabId);
        if (tab) tab.classList.add('active');

        closeMobileNav();

        if (tabId === 'dashboard-tab') {
            loadDashboardStats();
            loadComplaints();
            startPolling();
        }
        if (tabId === 'profile-tab') loadProfile();
        if (tabId === 'my-complaints-tab') loadMyComplaints();
        if (tabId === 'report-tab') {
            const uid = document.getElementById('user_id');
            if (uid) uid.value = currentUser ? currentUser.id : '';
        }
    }

    function setupTabListeners() {
        document.querySelectorAll('.nav-btn, .nav-link-inline').forEach(btn => {
            btn.addEventListener('click', e => {
                e.preventDefault();
                if (btn.id === 'logoutBtn') return;
                switchTab(btn.dataset.tab);
            });
        });
    }

    renderNavigation();
    switchTab(currentUser ? 'dashboard-tab' : 'login-tab');

    // ─────────────────────────────────────────
    //  POLLING
    // ─────────────────────────────────────────
    let pollInterval = null;

    function startPolling() {
        clearPolling();
        pollInterval = setInterval(async () => {
            try { await fetch('api/check_sla.php'); } catch (_) { }
            loadDashboardStats();
            if (currentListView === 'list') {
                loadComplaints(false); // silent refresh
            }
        }, 8000);
    }

    function clearPolling() {
        if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
    }

    // ─────────────────────────────────────────
    //  AUTH — LOGIN
    // ─────────────────────────────────────────
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async e => {
            e.preventDefault();
            const btn = loginForm.querySelector('.submit-btn');
            const btnText = btn.querySelector('.btn-text');
            const loader = btn.querySelector('.loader');
            const msg = document.getElementById('loginMessage');
            btn.disabled = true; btnText.style.display = 'none'; loader.style.display = 'block';
            msg.className = 'form-message'; msg.textContent = '';
            try {
                const fd = new FormData(loginForm);
                const res = await fetch('api/login.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(Object.fromEntries(fd.entries()))
                });
                const result = await res.json();
                if (result.status === 'success') {
                    currentUser = result.data.user;
                    localStorage.setItem('civic_user', JSON.stringify(currentUser));
                    loginForm.reset();

                    if (currentUser.role === 'government') {
                        window.location.href = 'gov.html';
                    } else {
                        renderNavigation();
                        switchTab('dashboard-tab');
                    }
                } else {
                    msg.textContent = result.message || 'Login failed.';
                    msg.className = 'form-message error';
                }
            } catch (_) {
                msg.textContent = 'Network error.'; msg.className = 'form-message error';
            } finally {
                btn.disabled = false; btnText.style.display = 'block'; loader.style.display = 'none';
            }
        });
    }

    // ─────────────────────────────────────────
    //  AUTH — REGISTER
    // ─────────────────────────────────────────
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async e => {
            e.preventDefault();
            const btn = registerForm.querySelector('.submit-btn');
            const btnText = btn.querySelector('.btn-text');
            const loader = btn.querySelector('.loader');
            const msg = document.getElementById('registerMessage');
            btn.disabled = true; btnText.style.display = 'none'; loader.style.display = 'block';
            msg.className = 'form-message'; msg.textContent = '';
            try {
                const fd = new FormData(registerForm);
                const reqData = Object.fromEntries(fd.entries());
                if (reqData.password.length < 6) throw new Error('Password too short.');
                const res = await fetch('api/register.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(reqData)
                });
                const result = await res.json();
                if (result.status === 'success') {
                    msg.textContent = result.message;
                    msg.className = 'form-message success';
                    registerForm.reset();
                    setTimeout(() => switchTab('login-tab'), 2000);
                } else {
                    msg.textContent = result.message || 'Registration failed.';
                    msg.className = 'form-message error';
                }
            } catch (err) {
                msg.textContent = err.message || 'Network error.'; msg.className = 'form-message error';
            } finally {
                btn.disabled = false; btnText.style.display = 'block'; loader.style.display = 'none';
            }
        });
    }

    // ─────────────────────────────────────────
    //  PROFILE
    // ─────────────────────────────────────────
    async function loadProfile() {
        if (!currentUser) return switchTab('login-tab');
        try {
            const res = await fetch(`api/get_user.php?user_id=${currentUser.id}`);
            const data = await res.json();
            if (data.status === 'success') {
                const u = data.data;
                document.getElementById('profName').textContent = u.name;
                document.getElementById('profEmail').textContent = u.email;
                document.getElementById('profPhone').textContent = u.phone;
                document.getElementById('profTotal').textContent = u.total_complaints;
                if (u.name) document.getElementById('profAvatar').textContent = u.name.charAt(0).toUpperCase();
                if (u.created_at) {
                    document.getElementById('profJoined').textContent = new Date(u.created_at)
                        .toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
                }
            }
        } catch (_) { }
    }

    // ─────────────────────────────────────────
    //  MY COMPLAINTS
    // ─────────────────────────────────────────
    async function loadMyComplaints() {
        if (!currentUser) return switchTab('login-tab');
        const grid = document.getElementById('myComplaintsGrid');
        if (!grid) return;
        grid.innerHTML = '<div class="loading-state">Loading your submissions…</div>';
        try {
            const res = await fetch(`api/get_user_complaints.php?user_id=${currentUser.id}`);
            const data = await res.json();
            if (data.status === 'success') renderComplaints(data.data, grid);
            else grid.innerHTML = `<div class="loading-state" style="color:var(--danger)">${data.message}</div>`;
        } catch (_) {
            grid.innerHTML = '<div class="loading-state" style="color:var(--danger)">Failed to load.</div>';
        }
    }

    // ─────────────────────────────────────────
    //  DASHBOARD STATS
    // ─────────────────────────────────────────
    async function loadDashboardStats() {
        try {
            const res = await fetch('api/get_dashboard_stats.php');
            const data = await res.json();
            if (data.status === 'success') {
                const s = data.data;
                animateCounter('stat-total', s.total ?? 0);
                animateCounter('stat-pending', s.pending ?? 0);
                animateCounter('stat-resolved', s.resolved ?? 0);
                animateCounter('stat-escalated', s.escalated ?? 0);
                animateCounter('stat-sla', s.sla_breached ?? 0);
            }
        } catch (_) { }
    }

    function animateCounter(id, target) {
        const el = document.getElementById(id);
        if (!el) return;
        const start = parseInt(el.textContent) || 0;
        const range = target - start;
        const duration = 600;
        const step = 16;
        const steps = duration / step;
        let current = start;
        const inc = range / steps;
        const timer = setInterval(() => {
            current += inc;
            if ((inc >= 0 && current >= target) || (inc < 0 && current <= target)) {
                el.textContent = target;
                clearInterval(timer);
            } else {
                el.textContent = Math.round(current);
            }
        }, step);
    }

    // ─────────────────────────────────────────
    //  COMPLAINTS — FILTERS
    // ─────────────────────────────────────────
    const statusFilter = document.getElementById('statusFilter');
    const categoryFilter = document.getElementById('categoryFilter');
    const searchFilter = document.getElementById('searchFilter');
    const dateFromFilter = document.getElementById('dateFromFilter');
    const dateToFilter = document.getElementById('dateToFilter');
    const resetFiltersBtn = document.getElementById('resetFiltersBtn');

    [statusFilter, categoryFilter, dateFromFilter, dateToFilter].forEach(el => {
        if (el) el.addEventListener('change', () => loadComplaints(true));
    });

    let searchTimeout = null;
    if (searchFilter) {
        searchFilter.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => loadComplaints(true), 350);
        });
    }

    if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener('click', () => {
            if (statusFilter) statusFilter.value = '';
            if (categoryFilter) categoryFilter.value = '';
            if (searchFilter) searchFilter.value = '';
            if (dateFromFilter) dateFromFilter.value = '';
            if (dateToFilter) dateToFilter.value = '';
            loadComplaints(true);
        });
    }

    async function loadComplaints(showLoader = true) {
        const grid = document.getElementById('complaintsGrid');
        if (!grid) return;
        if (showLoader) grid.innerHTML = '<div class="loading-state">Loading complaints…</div>';

        const params = new URLSearchParams();
        if (statusFilter?.value) params.set('status', statusFilter.value);
        if (categoryFilter?.value) params.set('category', categoryFilter.value);
        if (searchFilter?.value) params.set('search', searchFilter.value);
        if (dateFromFilter?.value) params.set('date_from', dateFromFilter.value);
        if (dateToFilter?.value) params.set('date_to', dateToFilter.value);

        try {
            const res = await fetch('api/get_complaints.php?' + params.toString());
            const data = await res.json();
            if (data.status === 'success') renderComplaints(data.data, grid);
            else grid.innerHTML = `<div class="loading-state" style="color:var(--danger)">Error: ${data.message}</div>`;
        } catch (_) {
            grid.innerHTML = '<div class="loading-state" style="color:var(--danger)">Failed to load complaints.</div>';
        }
    }

    // ─────────────────────────────────────────
    //  SLA HELPERS
    // ─────────────────────────────────────────
    function buildSlaBadge(sla_deadline, status) {
        if (!sla_deadline || status === 'Resolved') return '';
        const now = new Date();
        const deadline = new Date(sla_deadline);
        const diffMs = deadline - now;

        if (diffMs <= 0) {
            return `<span class="sla-badge breached">🚨 SLA BREACHED</span>`;
        }
        const diffH = Math.floor(diffMs / 3600000);
        const diffM = Math.floor((diffMs % 3600000) / 60000);
        const cls = diffH < 4 ? 'warning' : '';
        return `<span class="sla-badge ${cls}">⏳ ${diffH}h ${diffM}m left</span>`;
    }

    // ─────────────────────────────────────────
    //  RENDER COMPLAINTS
    // ─────────────────────────────────────────
    function renderComplaints(complaints, container) {
        if (!complaints || complaints.length === 0) {
            container.innerHTML = '<div class="loading-state">No complaints found.</div>';
            return;
        }
        let html = '';
        complaints.forEach(item => {
            const badgeClass = item.status.replace(/\s+/g, '');
            const dept = item.department_name || 'Unassigned';
            const category = item.category || 'General';
            const dateStr = new Date(item.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
            const slaBadge = buildSlaBadge(item.sla_deadline, item.status);
            const thumb = item.image_url
                ? `<img class="complaint-thumb" src="${item.image_url}" alt="Attachment" loading="lazy">`
                : '';

            // Escalation Badge Logic
            let escBadge = '';
            const escLevel = parseInt(item.escalation_level) || 1;
            if (escLevel === 2) escBadge = '<span class="badge EscalatedL1">⚠️ Level 2</span>';
            if (escLevel === 3 && item.status !== 'Critical') escBadge = '<span class="badge EscalatedL2">🚨 Level 3</span>';
            if (item.status === 'Critical') escBadge = '<span class="badge Critical">🔥 Critical</span>';

            html += `
                <div class="glass-card complaint-card" onclick="openComplaintModal('${item.id}')">
                    ${thumb}
                    <div class="card-inner">
                        <div class="complaint-id">#${item.id}</div>
                        <div class="complaint-desc">${escHtml(item.description)}</div>
                        <div class="badge-row">
                            <span class="badge ${badgeClass}">${item.status}</span>
                            ${escBadge}
                            <span class="badge General">${category}</span>
                            ${slaBadge ? slaBadge : ''}
                        </div>
                        <div class="complaint-footer">
                            <div class="comp-meta">
                                <b>${dept}</b>
                                <span>${dateStr}</span>
                            </div>
                            <div class="primary-btn" style="padding: 0.4rem 0.8rem; font-size: 0.75rem;">View Details</div>
                        </div>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
    }

    function escHtml(str) {
        const el = document.createElement('div');
        el.appendChild(document.createTextNode(str));
        return el.innerHTML;
    }

    // ─────────────────────────────────────────
    //  VIEW TOGGLE (List / Map)
    // ─────────────────────────────────────────
    let currentListView = 'list';
    let leafletMap = null;

    const listViewBtn = document.getElementById('listViewBtn');
    const mapViewBtn = document.getElementById('mapViewBtn');
    const complaintsGrid = document.getElementById('complaintsGrid');
    const mapView = document.getElementById('mapView');

    if (listViewBtn) {
        listViewBtn.addEventListener('click', () => {
            currentListView = 'list';
            listViewBtn.classList.add('active');
            mapViewBtn.classList.remove('active');
            complaintsGrid.style.display = '';
            mapView.style.display = 'none';
        });
    }

    if (mapViewBtn) {
        mapViewBtn.addEventListener('click', () => {
            currentListView = 'map';
            mapViewBtn.classList.add('active');
            listViewBtn.classList.remove('active');
            complaintsGrid.style.display = 'none';
            mapView.style.display = 'block';
            loadMapView();
        });
    }

    async function loadMapView() {
        const mapEl = document.getElementById('leafletMap');
        if (!mapEl) return;

        // Init Leaflet only once
        if (!leafletMap) {
            leafletMap = L.map('leafletMap').setView([20.5937, 78.9629], 5); // India default
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
                maxZoom: 18
            }).addTo(leafletMap);
        }

        // Clear existing markers
        leafletMap.eachLayer(layer => {
            if (layer instanceof L.Marker) leafletMap.removeLayer(layer);
        });

        // Try centering on current location if possible
        function centerLeafletMap() {
            if (navigator.geolocation && leafletMap) {
                navigator.geolocation.getCurrentPosition(pos => {
                    leafletMap.setView([pos.coords.latitude, pos.coords.longitude], 12);
                }, () => { });
            }
        }
        centerLeafletMap();

        const mapBtn = document.getElementById('publicMapLiveLocBtn');
        if (mapBtn) {
            mapBtn.addEventListener('click', centerLeafletMap);
        }

        try {
            const res = await fetch('api/get_map_complaints.php');
            const data = await res.json();
            if (data.status === 'success' && data.data.length > 0) {
                const bounds = [];
                data.data.forEach(c => {
                    const lat = parseFloat(c.lat);
                    const lng = parseFloat(c.lng);
                    if (isNaN(lat) || isNaN(lng)) return;
                    bounds.push([lat, lng]);

                    const colorMap = {
                        'Pending': '#F59E0B', 'In Progress': '#3B82F6',
                        'Resolved': '#10B981', 'Escalated L1': '#EF4444', 'Escalated L2': '#8B5CF6'
                    };
                    const color = colorMap[c.status] || '#64748B';

                    const icon = L.divIcon({
                        className: '',
                        html: `<div style="
                            width:14px;height:14px;border-radius:50%;background:${color};
                            border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.35);
                        "></div>`,
                        iconSize: [14, 14], iconAnchor: [7, 7]
                    });

                    L.marker([lat, lng], { icon })
                        .addTo(leafletMap)
                        .bindPopup(`
                            <strong>#${c.id}</strong><br>
                            ${c.description.substring(0, 80)}...<br>
                            <span style="font-size:.8rem;color:#666">${c.status}</span><br>
                            <a href="#" style="color:#4F46E5;font-size:.8rem" 
                               onclick="openComplaintModal('${c.id}');return false;">View Details →</a>
                        `);
                });

                if (bounds.length > 0) {
                    leafletMap.fitBounds(bounds, { padding: [40, 40] });
                }
            } else {
                mapEl.innerHTML = '<div class="loading-state">No geo-tagged complaints found.</div>';
            }
        } catch (_) {
            console.error('Map load failed');
        }
    }

    // ─────────────────────────────────────────
    //  COMPLAINT MODAL
    // ─────────────────────────────────────────
    const modal = document.getElementById('complaintModal');
    const modalBody = document.getElementById('modalBody');
    const closeBtn = document.getElementById('closeModalBtn');

    if (closeBtn) closeBtn.addEventListener('click', () => modal.classList.remove('show'));
    if (modal) modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('show'); });

    window.openComplaintModal = async function (id) {
        modal.classList.add('show');
        modalBody.innerHTML = '<div class="loading-state">Loading details…</div>';
        try {
            const res = await fetch(`api/get_complaint.php?id=${encodeURIComponent(id)}`);
            const result = await res.json();

            if (result.status === 'success') {
                const c = result.data.complaint;
                const timeline = result.data.timeline;
                const badgeClass = c.status.replace(/\s+/g, '');
                const slaBadge = buildSlaBadge(c.sla_deadline, c.status);
                const reporter = c.user_name || 'Anonymous';
                const dept = c.department_name || 'Unassigned';
                const category = c.category || 'General';

                let html = `
                    <div class="modal-body-pad">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem;">
                            <div>
                                <h2 style="font-size: 1.75rem; color: var(--text-main); margin-bottom: 0.25rem;">Complaint #${c.id}</h2>
                                <div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center;">
                                    <span class="badge ${badgeClass}">${c.status}</span>
                                    <span class="badge General">${category}</span>
                                </div>
                            </div>
                            <div style="text-align: right;">
                                ${slaBadge}
                            </div>
                        </div>

                        <div style="background: #f8fafc; padding: 1.5rem; border-radius: var(--radius-md); border: 1px solid var(--border); margin-bottom: 2rem;">
                            <h3 style="font-size: 0.875rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.75rem;">Issue Description</h3>
                            <p style="font-size: 1rem; line-height: 1.6; color: var(--text-main);">${escHtml(c.description)}</p>
                        </div>

                        ${(() => {
                        // Confirmation panel — only for the complaint owner when awaiting confirmation
                        const loggedUser = JSON.parse(localStorage.getItem('civic_user') || 'null');
                        const isOwner = loggedUser && (String(loggedUser.id) === String(c.user_id));
                        if (isOwner && c.status === 'Awaiting User Confirmation') {
                            return `
                                <div class="confirmation-panel">
                                    <h4>⚠️ Has your issue been resolved?</h4>
                                    <p style="font-size:0.875rem; color:#78350f; margin-bottom:1rem;">
                                        The government has marked your complaint as resolved.<br>
                                        Please confirm below — you have 48 hours to respond before it is auto-completed.
                                    </p>
                                    <div class="confirm-btn-row">
                                        <button class="btn-confirm" onclick="confirmResolution('${c.id}')">✔ Yes, Issue is Resolved</button>
                                        <button class="btn-reopen" onclick="rejectResolution('${c.id}')">❌ No, Still an Issue</button>
                                    </div>
                                </div>`;
                        } else if (c.status === 'Completed') {
                            return `<div style="background:#f0fdf4;border:1px solid #86efac;padding:1rem;border-radius:12px;margin-bottom:1.5rem;color:#065f46;text-align:center;">
                                    ✅ <strong>Completed</strong> — You confirmed this issue was resolved on ${c.confirmed_at ? new Date(c.confirmed_at).toLocaleDateString() : 'record'}.
                                </div>`;
                        } else if (c.status === 'Reopened') {
                            return `<div style="background:#fef2f2;border:1px solid #fca5a5;padding:1rem;border-radius:12px;margin-bottom:1.5rem;color:#991b1b;text-align:center;">
                                    🔴 <strong>Reopened</strong> — You reported this issue as unresolved. The authority has been notified.
                                </div>`;
                        }
                        return '';
                    })()}

                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5rem; margin-bottom: 2rem;">
                            <div class="info-group">
                                <label style="display: block; font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px;">Reporter</label>
                                <div style="font-weight: 600;">${escHtml(reporter)}</div>
                            </div>
                            <div class="info-group">
                                <label style="display: block; font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px;">Department</label>
                                <div style="font-weight: 600;">${escHtml(dept)}</div>
                            </div>
                            <div class="info-group">
                                <label style="display: block; font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px;">Filed Date</label>
                                <div style="font-weight: 600;">${new Date(c.created_at).toLocaleString()}</div>
                            </div>
                            <div class="info-group">
                                <label style="display: block; font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px;">Escalation Level</label>
                                <div style="font-weight: 600;">Level ${c.escalation_level || 1}</div>
                            </div>
                            <div class="info-group">
                                <label style="display: block; font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px;">SLA Deadline</label>
                                <div style="font-weight: 600; color: ${c.status !== 'Resolved' && new Date(c.sla_deadline) < new Date() ? 'var(--danger)' : 'inherit'}">${c.sla_deadline ? new Date(c.sla_deadline).toLocaleString() : 'N/A'}</div>
                            </div>
                        </div>
                `;

                // Map link if coordinates exist
                if (c.lat && c.lng) {
                    html += `
                        <div style="margin-bottom: 2rem;">
                            <a class="primary-btn" style="display: inline-flex; align-items: center; gap: 8px; width: auto;" href="https://www.openstreetmap.org/?mlat=${c.lat}&mlon=${c.lng}&zoom=16" target="_blank" rel="noopener">
                                📍 View Location on Map
                            </a>
                        </div>
                    `;
                }

                // Image
                if (c.image_url) {
                    html += `
                        <div style="margin-bottom: 2.5rem;">
                            <h3 style="font-size: 0.875rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1rem;">Attached Photo</h3>
                            <img src="${c.image_url}" alt="Attachment" style="width:100%; border-radius: var(--radius-md); border: 4px solid #f1f5f9; box-shadow: var(--shadow-md);">
                        </div>
                    `;
                }

                // Timeline
                if (timeline && timeline.length > 0) {
                    html += `
                        <div style="margin-top: 1rem;">
                            <h3 style="font-size: 0.875rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1.5rem;">Resolution Timeline</h3>
                            <div class="timeline">
                    `;
                    timeline.forEach(log => {
                        html += `
                            <div class="timeline-item">
                                <div class="timeline-dot"></div>
                                <div class="timeline-content">
                                    <div class="timeline-header">
                                        <span class="timeline-title">${escHtml(log.event_type)}</span>
                                        <span>${new Date(log.created_at).toLocaleDateString()}</span>
                                    </div>
                                    <div style="font-size: 0.875rem; color: var(--text-muted);">${escHtml(log.description)}</div>
                                </div>
                            </div>`;
                    });
                    html += `</div></div>`;
                }

                html += `</div>`; // Close modal-body-pad
                modalBody.innerHTML = html;
            } else {
                modalBody.innerHTML = `<div style="color:var(--danger)">${result.message}</div>`;
            }
        } catch (_) {
            modalBody.innerHTML = `<div style="color:var(--danger)">Error fetching details.</div>`;
        }
    };

    // ─────────────────────────────────────────
    //  DUAL CONFIRMATION RESOLUTION SYSTEM
    // ─────────────────────────────────────────
    window.confirmResolution = async function (complaintId) {
        const loggedUser = JSON.parse(localStorage.getItem('civic_user') || 'null');
        if (!loggedUser) { alert('Please log in to confirm resolution.'); return; }

        if (!confirm('Are you sure you want to confirm that your issue has been resolved? This will mark the complaint as Completed.')) return;

        try {
            const res = await fetch('api/confirm_resolution.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ complaint_id: complaintId, user_id: loggedUser.id })
            });
            const data = await res.json();
            if (data.status === 'success') {
                alert('✅ ' + data.message);
                document.getElementById('complaintModal').classList.remove('show');
                loadComplaints(); // Refresh list
            } else {
                alert('Error: ' + data.message);
            }
        } catch (e) {
            alert('Network error. Please try again.');
        }
    };

    window.rejectResolution = async function (complaintId) {
        const loggedUser = JSON.parse(localStorage.getItem('civic_user') || 'null');
        if (!loggedUser) { alert('Please log in to report this issue.'); return; }

        const reason = prompt('Please describe why the issue is still unresolved (or press OK to skip):', '');
        if (reason === null) return; // User cancelled

        try {
            const res = await fetch('api/reject_resolution.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ complaint_id: complaintId, user_id: loggedUser.id, reason: reason || 'Issue is still present.' })
            });
            const data = await res.json();
            if (data.status === 'success') {
                alert('🔄 ' + data.message);
                document.getElementById('complaintModal').classList.remove('show');
                loadComplaints();
            } else {
                alert('Error: ' + data.message);
            }
        } catch (e) {
            alert('Network error. Please try again.');
        }
    };

    // ─────────────────────────────────────────
    //  GEOLOCATION
    // ─────────────────────────────────────────
    const getLocationBtn = document.getElementById('getLocationBtn');
    const locationStatus = document.getElementById('locationStatus');
    const latInput = document.getElementById('lat');
    const lngInput = document.getElementById('lng');

    function autoFetchLocation() {
        if (!locationStatus || !latInput || !lngInput) return;
        if (!navigator.geolocation) {
            locationStatus.textContent = 'Geolocation not supported.';
            locationStatus.className = 'location-status error';
            return;
        }
        locationStatus.textContent = 'Locating…';
        locationStatus.className = 'location-status';

        navigator.geolocation.getCurrentPosition(pos => {
            const { latitude: lat, longitude: lng } = pos.coords;
            latInput.value = lat;
            lngInput.value = lng;
            locationStatus.textContent = `📍 Captured: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
            locationStatus.className = 'location-status success';
        }, err => {
            locationStatus.textContent = err.code === 1 ? 'Location access denied.' : 'Unable to get location.';
            locationStatus.className = 'location-status error';
        });
    }

    // Auto-fetch location right away on load
    autoFetchLocation();

    if (getLocationBtn) {
        getLocationBtn.addEventListener('click', autoFetchLocation);
    }



    // ─────────────────────────────────────────
    //  MOBILE CAMERA CAPTURE
    // ─────────────────────────────────────────
    const cameraModal = document.getElementById('cameraModal');
    const openCameraBtn = document.getElementById('openCameraBtn');
    const closeCameraBtn = document.getElementById('closeCameraBtn');
    const cameraVideo = document.getElementById('cameraVideo');
    const cameraCanvas = document.getElementById('cameraCanvas');
    const captureBtn = document.getElementById('captureBtn');
    const retakeBtn = document.getElementById('retakeBtn');
    const usePhotoBtn = document.getElementById('usePhotoBtn');
    const switchCameraBtn = document.getElementById('switchCameraBtn');
    const captureState = document.getElementById('captureState');
    const previewState = document.getElementById('previewState');

    const imageBase64Input = document.getElementById('image_base64');
    const capturedPreview = document.getElementById('capturedPreview');
    const capturedImg = document.getElementById('capturedImg');
    const removeCapturedBtn = document.getElementById('removeCapturedBtn');

    let cameraStream = null;
    let currentFacingMode = 'environment';

    async function startCamera() {
        try {
            if (cameraStream) stopCamera();
            const constraints = {
                video: { facingMode: currentFacingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
                audio: false
            };
            cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
            cameraVideo.srcObject = cameraStream;
            cameraModal.classList.add('active');
            captureState.style.display = 'flex';
            previewState.style.display = 'none';
        } catch (err) {
            console.error("Camera error:", err);
            alert("Unable to access camera. Please check permissions.");
        }
    }

    function stopCamera() {
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            cameraStream = null;
        }
        cameraVideo.srcObject = null;
        cameraModal.classList.remove('active');
    }

    if (openCameraBtn) openCameraBtn.addEventListener('click', startCamera);
    if (closeCameraBtn) closeCameraBtn.addEventListener('click', stopCamera);

    if (switchCameraBtn) {
        switchCameraBtn.addEventListener('click', () => {
            currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
            startCamera();
        });
    }

    if (captureBtn) {
        captureBtn.addEventListener('click', () => {
            const context = cameraCanvas.getContext('2d');
            cameraCanvas.width = cameraVideo.videoWidth;
            cameraCanvas.height = cameraVideo.videoHeight;
            context.drawImage(cameraVideo, 0, 0, cameraCanvas.width, cameraCanvas.height);

            cameraVideo.pause();
            captureState.style.display = 'none';
            previewState.style.display = 'flex';
        });
    }

    if (retakeBtn) {
        retakeBtn.addEventListener('click', () => {
            cameraVideo.play();
            captureState.style.display = 'flex';
            previewState.style.display = 'none';
        });
    }

    if (usePhotoBtn) {
        usePhotoBtn.addEventListener('click', () => {
            const dataUrl = cameraCanvas.toDataURL('image/jpeg', 0.7);
            imageBase64Input.value = dataUrl;
            capturedImg.src = dataUrl;
            capturedPreview.style.display = 'block';
            openCameraBtn.style.display = 'none'; // Hide CTA when photo exists

            stopCamera();
        });
    }

    if (removeCapturedBtn) {
        removeCapturedBtn.addEventListener('click', () => {
            imageBase64Input.value = '';
            capturedPreview.style.display = 'none';
            openCameraBtn.style.display = 'flex'; // Show CTA again
        });
    }

    // ─────────────────────────────────────────
    //  COMPLAINT SUBMISSION
    // ─────────────────────────────────────────
    const complaintForm = document.getElementById('complaintForm');
    const formMessage = document.getElementById('formMessage');

    if (complaintForm) {
        complaintForm.addEventListener('submit', async e => {
            e.preventDefault();
            if (!currentUser) { switchTab('login-tab'); return; }

            // Validate Evidence
            if (!imageBase64Input.value) {
                formMessage.textContent = '❌ Please capture a live photo as evidence.';
                formMessage.className = 'form-message error';
                return;
            }

            const btn = complaintForm.querySelector('.submit-btn');
            const btnText = btn.querySelector('.btn-text');
            const loader = btn.querySelector('.loader');
            btn.disabled = true; btnText.style.display = 'none'; loader.style.display = 'block';
            formMessage.className = 'form-message'; formMessage.textContent = '';

            const formData = new FormData(complaintForm);
            if (!formData.get('user_id')) formData.set('user_id', currentUser.id);

            try {
                const res = await fetch('api/submit_complaint.php', { method: 'POST', body: formData });
                const result = await res.json();
                if (result.status === 'success') {
                    formMessage.textContent = '✅ Issue reported successfully!';
                    formMessage.className = 'form-message success';
                    complaintForm.reset();
                    if (capturedPreview) capturedPreview.style.display = 'none';
                    if (openCameraBtn) openCameraBtn.style.display = 'flex';
                    if (locationStatus) { locationStatus.textContent = 'Location not captured.'; locationStatus.className = 'location-status'; }
                    if (latInput) latInput.value = '';
                    if (lngInput) lngInput.value = '';
                    setTimeout(() => switchTab('my-complaints-tab'), 1500);
                } else {
                    formMessage.textContent = result.message || 'An error occurred.';
                    formMessage.className = 'form-message error';
                }
            } catch (_) {
                formMessage.textContent = 'Network error. Please try again.';
                formMessage.className = 'form-message error';
            } finally {
                btn.disabled = false; btnText.style.display = 'block'; loader.style.display = 'none';
            }
        });
    }

    // ─────────────────────────────────────────
    //  CHATBOT
    // ─────────────────────────────────────────
    const chatToggle = document.getElementById('chatbotToggle');
    const chatWindow = document.getElementById('chatWindow');
    const chatClose = document.getElementById('chatClose');
    const chatInput = document.getElementById('chatInput');
    const chatSend = document.getElementById('chatSend');
    const chatMessages = document.getElementById('chatMessages');

    if (chatToggle) chatToggle.addEventListener('click', () => chatWindow.classList.toggle('open'));
    if (chatClose) chatClose.addEventListener('click', () => chatWindow.classList.remove('open'));

    function appendMsg(text, type) {
        const div = document.createElement('div');
        div.className = `chat-msg ${type}`;
        div.innerHTML = text;
        chatMessages.appendChild(div);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    const BOT_RESPONSES = [
        { match: /\b(hi|hello|hey)\b/i, reply: `👋 Hello! How can I help? Type <strong>help</strong> to see options.` },
        { match: /\bhelp\b/i, reply: `Here's what I can do:<br>• <strong>status</strong> — Check complaint status<br>• <strong>submit</strong> — Report a new issue<br>• <strong>dashboard</strong> — View public issues<br>• <strong>profile</strong> — View your profile` },
        { match: /\b(status|track|check)\b/i, reply: `To check your complaint status: go to <strong>My Issues</strong> tab, or click on any complaint card. You'll see the full timeline there.` },
        { match: /\b(submit|report|new|create)\b/i, reply: `Click <strong>Report Issue</strong> in the navigation. You'll need to be logged in. Describe the issue and optionally attach a photo and your GPS location!` },
        { match: /\b(dashboard|public|issues|map)\b/i, reply: `The <strong>Dashboard</strong> tab shows all public complaints. You can switch to <strong>Map View</strong> to see issues on an interactive map, or filter by status, category, date, or complaint ID.` },
        { match: /\b(profile|account|my)\b/i, reply: `Visit your <strong>Profile</strong> tab to see your name, email, phone, and total submissions.` },
        { match: /\b(sla|deadline|escalat)\b/i, reply: `🕐 <strong>SLA</strong> (Service Level Agreement) is the time limit for resolving a complaint. If it expires before resolution, the complaint is auto-escalated. You'll see a countdown badge on each card.` },
        { match: /\b(register|sign.?up)\b/i, reply: `Click <strong>Register</strong> in the nav bar. Fill in your name, email, phone, and a secure password.` },
        { match: /\b(thanks?|thank you)\b/i, reply: `You're welcome! 😊 Let me know if you need anything else.` },
    ];

    function getBotReply(input) {
        const lower = input.toLowerCase();
        for (const r of BOT_RESPONSES) {
            if (r.match.test(lower)) return r.reply;
        }
        return `🤔 I'm not sure about that. Try asking about <strong>status</strong>, <strong>submit</strong>, <strong>dashboard</strong>, or <strong>SLA</strong>.`;
    }

    function sendChatMessage() {
        const text = chatInput.value.trim();
        if (!text) return;
        appendMsg(escHtml(text), 'user');
        chatInput.value = '';
        setTimeout(() => appendMsg(getBotReply(text), 'bot'), 450);
    }

    if (chatSend) chatSend.addEventListener('click', sendChatMessage);
    if (chatInput) chatInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendChatMessage(); });

});
