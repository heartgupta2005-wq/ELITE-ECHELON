// js/gov.js
let user = null;
let pollInterval = null;
let govMap = null;
let govMarkers = L.layerGroup();
let departmentsData = [];

// ══════════════ INIT & AUTH ══════════════
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    initNav();
    initFilters();
    initModalEvents();
    initDeptEvents();

    // Fetch departments list for dropdowns
    fetchDepartments().then(depts => {
        departmentsData = depts;
        populateDeptDropdowns(depts);

        loadGovStats();
        loadGovComplaints();
        initGovMap();

        pollInterval = setInterval(() => {
            fetchStatsSilent();
            fetchComplaintsSilent();
        }, 10000);
    });
});

function checkAuth() {
    const rawUser = localStorage.getItem('civic_user');
    if (!rawUser) { window.location.href = 'index.html'; return; }

    user = JSON.parse(rawUser);
    if (user.role !== 'government') {
        window.location.href = 'index.html';
        return;
    }

    // Populate Nav
    document.getElementById('navName').textContent = user.name;
    document.getElementById('navAvatar').textContent = user.name.charAt(0).toUpperCase();

    const badge = document.getElementById('govBadge');
    if (user.is_admin == 1) {
        document.getElementById('navRole').textContent = 'System Admin';
        badge.textContent = 'Admin';
        badge.classList.remove('officer');
    } else {
        document.getElementById('navRole').textContent = user.department_name || 'Officer';
        badge.textContent = 'Officer';
        badge.classList.add('officer');

        // Hide Admin tabs and filters
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
        document.getElementById('gDeptFilter').style.display = 'none';

        // Change dashboard sub
        document.getElementById('dashboardSubtitle').textContent = (user.department_name || 'Your Dept') + ' Overview';
        document.getElementById('complaintsPanelSub').textContent = (user.department_name || 'Your Dept') + ' Complaints';
    }

    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('civic_user');
        window.location.href = 'index.html';
    });
}

function initNav() {
    const btns = document.querySelectorAll('.nav-btn');
    const panels = document.querySelectorAll('.gov-panel');

    btns.forEach(btn => {
        btn.addEventListener('click', () => {
            btns.forEach(b => b.classList.remove('active'));
            panels.forEach(p => p.classList.remove('active'));

            btn.classList.add('active');
            const target = btn.getAttribute('data-panel');
            document.getElementById(target).classList.add('active');

            if (target === 'dashboard-panel' && govMap) {
                setTimeout(() => govMap.invalidateSize(), 150);
            }
            if (target === 'departments-panel') {
                loadDepartmentsPanel();
            }
        });
    });
}

// ══════════════ DASHBOARD STATS ══════════════
async function loadGovStats() {
    await fetchStatsSilent(true);
}
async function fetchStatsSilent(animate = false) {
    try {
        let url = 'api/get_dashboard_stats.php';
        if (user.is_admin == 0 && user.department_id) {
            url += `?department_id=${user.department_id}`;
        }

        const res = await fetch(url);
        const json = await res.json();

        if (json.status === 'success') {
            const d = json.data;
            updateStat('gs-total', d.total, animate);
            updateStat('gs-pending', d.pending, animate);
            updateStat('gs-inprogress', d.in_progress, animate);
            updateStat('gs-resolved', d.resolved, animate);
            updateStat('gs-escalated', d.escalated, animate);
            updateStat('gs-sla', d.sla_breached, animate);
        }
    } catch (e) {
        console.error("Stats poll error", e);
    }
}
function updateStat(id, newVal, animate) {
    const el = document.getElementById(id);
    if (!el) return;
    if (animate) {
        let start = 0;
        const dur = 800;
        const startTime = performance.now();
        const step = (now) => {
            const prog = Math.min((now - startTime) / dur, 1);
            el.textContent = Math.floor(prog * newVal);
            if (prog < 1) requestAnimationFrame(step);
            else el.textContent = newVal;
        };
        requestAnimationFrame(step);
    } else {
        el.textContent = newVal;
    }
}

// ══════════════ LEAFLET MAP ══════════════
function initGovMap() {
    govMap = L.map('govLeafletMap').setView([28.6139, 77.2090], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(govMap);
    govMarkers.addTo(govMap);

    function centerGovMap() {
        if (navigator.geolocation && govMap) {
            navigator.geolocation.getCurrentPosition(pos => {
                govMap.setView([pos.coords.latitude, pos.coords.longitude], 12);
            }, () => { });
        }
    }
    centerGovMap();

    const liveBtn = document.getElementById('govMapLiveLocBtn');
    if (liveBtn) liveBtn.addEventListener('click', centerGovMap);

    document.getElementById('refreshMapBtn').addEventListener('click', () => {
        fetchComplaintsSilent(); // will update markers
    });
}
function updateMapMarkers(complaints) {
    govMarkers.clearLayers();
    if (!govMap || !complaints) return;

    let bounds = [];

    complaints.forEach(c => {
        if (c.lat && c.lng && !isNaN(c.lat) && !isNaN(c.lng)) {
            let color = 'gray';
            if (c.status === 'Pending') color = 'orange';
            else if (c.status === 'In Progress') color = 'blue';
            else if (c.status === 'Resolved') color = 'green';
            else if (c.status.includes('Escalated')) color = 'red';

            const markerHtml = `
                <div style="background-color:${color}; width:16px; height:16px; border-radius:50%; border:2px solid white; box-shadow:0 0 4px rgba(0,0,0,0.5);"></div>
            `;
            const icon = L.divIcon({ html: markerHtml, className: '', iconSize: [16, 16], iconAnchor: [8, 8] });

            const popup = `
                <div style="font-family:Inter,sans-serif;">
                    <div style="font-weight:700;font-size:12px;margin-bottom:4px;">${c.id}</div>
                    <div style="font-size:11px;color:#666;">${c.status} | Dept: ${c.department_name || 'Unassigned'}</div>
                    <button style="margin-top:6px;width:100%;padding:4px;border:none;background:#4F46E5;color:white;border-radius:4px;cursor:pointer;font-size:10px;" 
                            onclick="openGovModal('${c.id}')">View Details</button>
                </div>
            `;

            const lat = parseFloat(c.lat);
            const lng = parseFloat(c.lng);
            L.marker([lat, lng], { icon }).bindPopup(popup).addTo(govMarkers);
            bounds.push([lat, lng]);
        }
    });

    if (bounds.length > 0) {
        govMap.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
}

// ══════════════ COMPLAINTS TABLE ══════════════
function initFilters() {
    ['gStatusFilter', 'gCatFilter', 'gDeptFilter', 'gDateFrom', 'gDateTo'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', loadGovComplaints);
    });
    let t;
    document.getElementById('gSearchFilter').addEventListener('input', () => {
        clearTimeout(t); t = setTimeout(loadGovComplaints, 300);
    });
    document.getElementById('gResetFilters').addEventListener('click', () => {
        document.getElementById('gStatusFilter').value = '';
        document.getElementById('gCatFilter').value = '';
        if (document.getElementById('gDeptFilter')) document.getElementById('gDeptFilter').value = '';
        document.getElementById('gSearchFilter').value = '';
        document.getElementById('gDateFrom').value = '';
        document.getElementById('gDateTo').value = '';
        loadGovComplaints();
    });
}

async function loadGovComplaints() {
    document.getElementById('complaintsTableBody').innerHTML = '<tr><td colspan="8" class="table-empty">Loading…</td></tr>';
    await fetchComplaintsSilent();
}
async function fetchComplaintsSilent() {
    try {
        const p = new URLSearchParams();
        p.append('is_admin', user.is_admin);
        if (user.is_admin == 0 && user.department_id) {
            p.append('department_id', user.department_id); // Security restriction
        }

        const status = document.getElementById('gStatusFilter').value;
        const cat = document.getElementById('gCatFilter').value;
        const search = document.getElementById('gSearchFilter').value;
        const d_from = document.getElementById('gDateFrom').value;
        const d_to = document.getElementById('gDateTo').value;
        const f_dept = document.getElementById('gDeptFilter') ? document.getElementById('gDeptFilter').value : '';

        if (status) p.append('status', status);
        if (cat) p.append('category', cat);
        if (search) p.append('search', search);
        if (d_from) p.append('date_from', d_from);
        if (d_to) p.append('date_to', d_to);
        if (user.is_admin == 1 && f_dept) p.append('filter_dept', f_dept);

        const res = await fetch('api/get_all_complaints.php?' + p.toString());
        const json = await res.json();

        const tbody = document.getElementById('complaintsTableBody');

        if (json.status === 'success') {
            updateMapMarkers(json.data); // Update map

            if (json.data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" class="table-empty">No complaints found.</td></tr>';
                return;
            }

            tbody.innerHTML = '';
            json.data.forEach(c => {
                const tr = document.createElement('tr');
                tr.onclick = (e) => {
                    // Prevent row click if clicking action button
                    if (!e.target.closest('.act-btn')) openGovModal(c.id);
                };

                const sCls = c.status.replace(/\s+/g, '');

                // Escalation Badge Logic
                let escBadge = '';
                const escLevel = parseInt(c.escalation_level) || 1;
                if (escLevel === 2) escBadge = '<div class="badge EscalatedL1" style="margin-top:4px;">⚠️ L2: Head</div>';
                if (escLevel === 3 && c.status !== 'Critical') escBadge = '<div class="badge EscalatedL2" style="margin-top:4px;">🚨 L3: Admin</div>';
                if (c.status === 'Critical') escBadge = '<div class="badge Critical" style="margin-top:4px;">🔥 CRITICAL</div>';

                const badge = `<div><span class="badge ${sCls}">${c.status}</span>${escBadge}</div>`;

                let slaHtml = '—';
                if (c.status !== 'Resolved' && c.sla_deadline) {
                    const diff = new Date(c.sla_deadline) - new Date();
                    const hrs = Math.floor(diff / (1000 * 60 * 60));
                    if (diff < 0) slaHtml = `<span class="sla-badge breach">BREACHED</span>`;
                    else if (hrs < 4) slaHtml = `<span class="sla-badge warn">${hrs}h left</span>`;
                    else slaHtml = `<span class="sla-badge">${hrs}h left</span>`;
                }

                // Actions Column
                let actions = '';
                if (user.is_admin == 1) {
                    actions += `<button class="act-btn" onclick="openGovModal('${c.id}')">Manage</button>`;
                } else if (c.status !== 'Resolved') {
                    actions += `<button class="act-btn green" onclick="openGovModal('${c.id}')">Update</button>`;
                } else {
                    actions += `<button class="act-btn" onclick="openGovModal('${c.id}')">View</button>`;
                }

                tr.innerHTML = `
                    <td class="td-id">#${c.id}</td>
                    <td class="td-desc">${c.description}</td>
                    <td class="td-reporter">${c.user_name || 'Anonymous'}</td>
                    <td>${badge}</td>
                    <td>${c.department_name || '<span class="td-reporter">Unassigned</span>'}</td>
                    <td>${slaHtml}</td>
                    <td class="td-reporter">${new Date(c.created_at).toLocaleDateString()}</td>
                    <td class="actions-cell">
                        ${actions}
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }
    } catch (e) {
        console.error("Complaints poll error", e);
    }
}

// ══════════════ COMPLAINT MODAL ══════════════
let currentModalComplaintId = null;

function initModalEvents() {
    document.getElementById('govModalClose').addEventListener('click', closeGovModal);
    document.getElementById('govModal').addEventListener('click', (e) => {
        if (e.target.id === 'govModal') closeGovModal();
    });
}
function closeGovModal() {
    document.getElementById('govModal').classList.remove('open');
    currentModalComplaintId = null;
}

async function openGovModal(id) {
    currentModalComplaintId = id;
    const m = document.getElementById('govModal');
    const b = document.getElementById('govModalBody');
    b.innerHTML = '<div style="color:var(--muted);text-align:center;padding:2rem;">Loading details...</div>';
    m.classList.add('open');

    try {
        // Fetch specific complaint from the list query
        const res = await fetch(`api/get_all_complaints.php?search=${id}&is_admin=1`);
        const json = await res.json();

        if (json.status !== 'success' || !json.data || json.data.length === 0) {
            b.innerHTML = '<div class="form-msg error">Complaint not found or access denied.</div>';
            return;
        }

        const c = json.data.find(x => x.id === id); // exact match
        if (!c) { b.innerHTML = '<div class="form-msg error">Details not found.</div>'; return; }

        // Fetch timeline + remarks
        const [tlRes, rmkRes] = await Promise.all([
            fetch(`api/get_timeline.php?complaint_id=${id}`).then(r => r.json()).catch(() => ({ data: [] })),
            fetch(`api/get_remarks.php?complaint_id=${id}`).then(r => r.json()).catch(() => ({ data: [] }))
        ]);

        const timeline = tlRes.status === 'success' ? tlRes.data : [];
        const remarks = rmkRes.status === 'success' ? rmkRes.data : [];

        renderGovModal(c, timeline, remarks);

    } catch (e) {
        b.innerHTML = `<div class="form-msg error">Error loading: ${e.message}</div>`;
    }
}

function renderGovModal(c, timeline, remarks) {
    const b = document.getElementById('govModalBody');
    const sCls = c.status.replace(/\s+/g, '');

    // SLA string
    let slaStr = c.sla_deadline ? new Date(c.sla_deadline).toLocaleString() : 'N/A';

    // Image / Map link
    let imgHtml = c.image_url ? `<img src="${c.image_url}" class="modal-img" alt="Attachment">` : '';
    let mapLinkHtml = '';
    if (c.lat && c.lng) {
        mapLinkHtml = `<a href="https://www.openstreetmap.org/?mlat=${c.lat}&mlon=${c.lng}#map=17/${c.lat}/${c.lng}" target="_blank" class="map-link">📍 View on Map (${c.lat}, ${c.lng})</a>`;
    }

    // Assign Dept Select (Admin Only)
    let assignHtml = '';
    if (user.is_admin == 1) {
        let opts = `<option value="">-- Select Department --</option>`;
        departmentsData.forEach(d => {
            opts += `<option value="${d.id}" ${c.department_id == d.id ? 'selected' : ''}>${d.name}</option>`;
        });
        assignHtml = `
            <div class="assign-row">
                <label>Assign Dept:</label>
                <select id="modalAssignSelect">${opts}</select>
                <button class="primary-btn" onclick="assignDept('${c.id}')" style="padding:0.4rem 1rem;font-size:0.8rem;">Save Transfer</button>
            </div>
        `;
    }

    // Status Select (Officer or Admin)
    // NOTE: 'Govt Resolved' triggers the dual-confirmation flow — public user must then confirm/reject
    let ops = `
        <option value="Pending" ${c.status === 'Pending' ? 'selected' : ''}>Pending</option>
        <option value="In Progress" ${c.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
        <option value="Govt Resolved" ${c.status === 'Govt Resolved' ? 'selected' : ''}>Govt Resolved (Awaits User)</option>
    `;
    if (user.is_admin == 1) {
        ops += `<option value="Escalated L1" ${c.status === 'Escalated L1' ? 'selected' : ''}>Escalated L1</option>
                <option value="Escalated L2" ${c.status === 'Escalated L2' ? 'selected' : ''}>Escalated L2</option>`;
    }

    // Show read-only info for terminal statuses
    let terminalInfo = '';
    if (c.status === 'Awaiting User Confirmation') {
        terminalInfo = `<div style="background:#fff7ed; border:1px solid #fed7aa; padding:10px; border-radius:8px; margin-bottom:.8rem; color:#9a3412; font-size:.85rem;">
            ⏳ <strong>Awaiting User Confirmation</strong> — The public user must confirm or reject this resolution.
            ${c.resolved_at ? '<br>Resolved at: ' + new Date(c.resolved_at).toLocaleString() : ''}
        </div>`;
    } else if (c.status === 'Completed') {
        terminalInfo = `<div style="background:#f0fdf4; border:1px solid #86efac; padding:10px; border-radius:8px; margin-bottom:.8rem; color:#065f46; font-size:.85rem;">
            ✅ <strong>Completed</strong> — Both government and user have confirmed resolution.
            ${c.confirmed_at ? '<br>Confirmed at: ' + new Date(c.confirmed_at).toLocaleString() : ''}
        </div>`;
    } else if (c.status === 'Reopened') {
        terminalInfo = `<div style="background:#fef2f2; border:1px solid #fca5a5; padding:10px; border-radius:8px; margin-bottom:.8rem; color:#991b1b; font-size:.85rem;">
            🔴 <strong>Reopened</strong> — User rejected the resolution. Please investigate again.
        </div>`;
    }
    const statusHtml = `
        <div class="status-row">
            <label>Update Status:</label>
            <select id="modalStatusSelect">${ops}</select>
            <input type="text" id="modalStatusRemark" placeholder="Optional remark for update..." style="flex:1;background:rgba(255,255,255,.06);border:1px solid var(--border);color:var(--text);padding:.4rem .7rem;border-radius:6px;font-family:var(--font);">
            <button class="primary-btn" onclick="updateGovStatus('${c.id}')" style="padding:0.4rem 1rem;font-size:0.8rem;background:var(--secondary);">Save Status</button>
        </div>
    `;

    // Remarks Section
    let rmkHtml = '<div class="remark-list">';
    if (remarks.length === 0) {
        rmkHtml += '<div style="color:var(--muted);font-size:.85rem;">No internal remarks found.</div>';
    } else {
        remarks.forEach(r => {
            rmkHtml += `
            <div class="remark-item">
                <div class="remark-meta"><strong>${r.user_name || 'Officer'}</strong> • ${new Date(r.created_at).toLocaleString()}</div>
                <div class="remark-text">${r.remark}</div>
            </div>`;
        });
    }
    rmkHtml += '</div>';
    rmkHtml += `
        <div class="remark-input-row">
            <textarea id="newRemarkArea" placeholder="Add an internal remark (not visible to public)..."></textarea>
            <button class="primary-btn" onclick="addGovRemark('${c.id}')">Submit</button>
        </div>
    `;

    // Timeline Section
    let tlHtml = '<div class="timeline">';
    if (timeline.length === 0) tlHtml += '<div>No events.</div>';
    timeline.forEach(t => {
        tlHtml += `
            <div class="tl-item">
                <div class="tl-date">${new Date(t.created_at).toLocaleString()}</div>
                <div class="tl-title">${t.event_type}</div>
                <div class="tl-desc">${t.description}</div>
            </div>
        `;
    });
    tlHtml += '</div>';

    b.innerHTML = `
        <div class="modal-id">#${c.id} <span class="badge ${sCls}" style="margin-left:.5rem;">${c.status}</span></div>
        <div class="modal-title">Control Panel</div>
        
        <div class="meta-grid">
            <div><strong>Filed:</strong> ${new Date(c.created_at).toLocaleString()}</div>
            <div><strong>SLA Deadline:</strong> <span style="${c.status !== 'Resolved' && new Date(c.sla_deadline) < new Date() ? 'color:var(--danger)' : ''}">${slaStr}</span></div>
            <div><strong>Escalation Level:</strong> Level ${c.escalation_level || 1}</div>
            <div><strong>Department:</strong> ${c.department_name || 'Unassigned'}</div>
            <div><strong>Category:</strong> ${c.category || 'General'}</div>
            <div><strong>Reporter:</strong> ${c.user_name || 'Anonymous'} (${c.user_phone || 'No phone'})</div>
            <div><strong>Email:</strong> ${c.user_email || 'No email'}</div>
        </div>
        
        <div style="background:rgba(255,255,255,.04);padding:1rem;border-radius:12px;margin-bottom:1rem;border:1px solid var(--border);">
            <div style="font-weight:700;font-size:.85rem;margin-bottom:.5rem;color:var(--muted);">COMPLAINT DESCRIPTION</div>
            <div style="font-size:.95rem;line-height:1.5;">${c.description}</div>
        </div>
        
        ${mapLinkHtml}
        ${imgHtml}
        
        ${assignHtml}
        ${terminalInfo}
        ${statusHtml}
        ${user.is_admin == 1 ? `<div style="margin-top:1rem; padding-top:1rem; border-top:1px solid rgba(255,255,255,0.1); text-align:right;"><button class="primary-btn" style="background:var(--danger);" onclick="deleteGovComplaint('${c.id}')">🗑 Permanently Delete</button></div>` : ''}
        
        <div class="meta-grid" style="grid-template-columns:1fr 1fr; gap:2rem; margin-top:2rem;">
            <div>
                <div class="modal-section-title">Internal Remarks</div>
                ${rmkHtml}
            </div>
            <div>
                <div class="modal-section-title">Timeline History</div>
                ${tlHtml}
            </div>
        </div>
    `;
}

// ══════════════ ACTION HELPERS ══════════════
async function assignDept(id) {
    const sel = document.getElementById('modalAssignSelect');
    if (!sel) return;
    const deptId = sel.value;
    if (!deptId) { alert("Select a department."); return; }

    try {
        const res = await fetch('api/assign_department.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                complaint_id: id,
                department_id: deptId,
                is_admin: user.is_admin,
                assigner_name: user.name
            })
        });
        const json = await res.json();
        if (json.status === 'success') {
            loadGovComplaints();
            openGovModal(id); // reload modal
        } else alert(json.message);
    } catch (e) { alert("Error assigning."); }
}

async function updateGovStatus(id) {
    const sel = document.getElementById('modalStatusSelect');
    const rem = document.getElementById('modalStatusRemark').value;
    if (!sel) return;

    try {
        if (sel.value === 'Govt Resolved') {
            // Trigger Dual-Confirmation Flow
            const res = await fetch('api/mark_resolved.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    complaint_id: id,
                    govt_user_id: user.id,
                    remark: rem || 'Resolved by government officer.'
                })
            });
            const json = await res.json();
            if (json.status === 'success') {
                loadGovComplaints();
                openGovModal(id); // reload modal
            } else alert(json.message);
            return;
        }

        // Standard status updates
        let msg = `Status updated to ${sel.value} by ${user.name}.`;
        if (rem) msg += ` Note: ${rem}`;

        const res = await fetch('api/update_status.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: id,
                status: sel.value,
                user_id: user.id,
                is_admin: user.is_admin,
                department_id: user.department_id,
                message: msg
            })
        });
        const json = await res.json();
        if (json.status === 'success') {
            loadGovComplaints();
            openGovModal(id); // reload
        } else alert(json.message);
    } catch (e) { alert("Error updating status."); }
}

async function deleteGovComplaint(id) {
    if (!confirm("Are you ABSOLUTELY sure you want to permanently delete this complaint? This cannot be undone.")) return;

    try {
        const res = await fetch('api/delete_complaint.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: id, is_admin: user.is_admin })
        });
        const json = await res.json();
        if (json.status === 'success') {
            closeGovModal();
            loadGovComplaints();
        } else {
            alert(json.message);
        }
    } catch (e) { alert("Error deleting complaint."); }
}

async function addGovRemark(id) {
    const txt = document.getElementById('newRemarkArea').value;
    if (!txt.trim()) return;

    const btn = event.target;
    btn.textContent = 'Saving...'; btn.disabled = true;

    try {
        const res = await fetch('api/add_remark.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                complaint_id: id,
                user_id: user.id,
                user_name: user.name,
                remark: txt,
                role: user.role
            })
        });
        const json = await res.json();
        if (json.status === 'success') openGovModal(id);
        else { alert(json.message); btn.textContent = 'Submit'; btn.disabled = false; }
    } catch (e) { alert("Error saving remark."); btn.textContent = 'Submit'; btn.disabled = false; }
}

// ══════════════ DEPARTMENTS (ADMIN) ══════════════
async function fetchDepartments() {
    try {
        const res = await fetch('api/get_departments.php');
        const json = await res.json();
        if (json.status === 'success') return json.data;
    } catch (e) { }
    return [];
}
function populateDeptDropdowns(depts) {
    const gf = document.getElementById('gDeptFilter');
    if (gf) {
        depts.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d.id; opt.textContent = d.name;
            gf.appendChild(opt);
        });
    }
}

function initDeptEvents() {
    document.getElementById('addDeptBtn').addEventListener('click', () => {
        const form = document.getElementById('deptFormCard');
        if (form.style.display === 'block') form.style.display = 'none';
        else {
            document.getElementById('deptEditId').value = '';
            document.getElementById('deptName').value = '';
            document.getElementById('deptDesc').value = '';
            document.getElementById('deptEmail').value = '';
            document.getElementById('deptThreshold').value = '10';
            document.getElementById('deptFormTitle').textContent = 'Add Department';
            document.getElementById('deptFormMsg').className = 'form-msg';
            document.getElementById('deptFormMsg').textContent = '';
            form.style.display = 'block';
        }
    });

    document.getElementById('closeDeptForm').addEventListener('click', () => {
        document.getElementById('deptFormCard').style.display = 'none';
    });

    document.getElementById('saveDeptBtn').addEventListener('click', async () => {
        const id = document.getElementById('deptEditId').value;
        const name = document.getElementById('deptName').value;
        const desc = document.getElementById('deptDesc').value;
        const email = document.getElementById('deptEmail').value;
        const threshold = document.getElementById('deptThreshold').value;
        const msg = document.getElementById('deptFormMsg');

        if (!name.trim()) {
            msg.className = 'form-msg error'; msg.textContent = 'Name is required.'; return;
        }

        msg.className = 'form-msg'; msg.textContent = 'Saving...';
        try {
            const payload = {
                action: id ? 'edit' : 'add',
                is_admin: user.is_admin,
                name,
                description: desc,
                alert_email: email,
                complaint_threshold: threshold
            };
            if (id) payload.id = id;

            const res = await fetch('api/add_department.php', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const json = await res.json();
            if (json.status === 'success') {
                msg.className = 'form-msg success'; msg.textContent = json.message;
                departmentsData = await fetchDepartments(); // refresh
                populateDeptDropdowns(departmentsData);
                loadDepartmentsPanel(); // refresh table
                setTimeout(() => document.getElementById('deptFormCard').style.display = 'none', 1000);
            } else {
                msg.className = 'form-msg error'; msg.textContent = json.message;
            }
        } catch (e) {
            msg.className = 'form-msg error'; msg.textContent = 'Failed to save.';
        }
    });
}

function loadDepartmentsPanel() {
    const tbody = document.getElementById('deptsTableBody');
    tbody.innerHTML = '';

    if (departmentsData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="table-empty">No departments.</td></tr>';
        return;
    }

    departmentsData.forEach((d, idx) => {
        const tr = document.createElement('tr');
        const activeCls = d.active_count >= (d.complaint_threshold || 10) ? 'breach' : '';
        tr.innerHTML = `
            <td>${idx + 1}</td>
            <td style="font-weight:700;color:white;">${d.name}</td>
            <td style="color:var(--muted);">${d.description || '—'}</td>
            <td style="font-size:0.8rem;">${d.alert_email || '<span style="color:#666">No Alert Email</span>'}</td>
            <td><span style="font-weight:700;">${d.complaint_threshold || 10}</span></td>
            <td><span class="sla-badge ${activeCls}">${d.active_count || 0} Open</span></td>
            <td><span class="badge Resolved" style="padding:.2rem .5rem">${d.total_resolved || 0} Checkins</span></td>
            <td class="actions-cell">
                <button class="act-btn green" onclick="editDept(${d.id}, '${d.name.replace(/'/g, "\\'")}', '${(d.description || '').replace(/'/g, "\\'")}', '${(d.alert_email || '').replace(/'/g, "\\'")}', ${d.complaint_threshold})">Edit</button>
                <button class="act-btn" style="background:rgba(79,70,229,0.1);color:#818CF8;border-color:rgba(79,70,229,0.3)" onclick="sendManualAlert(${d.id})">📧 Send Alert</button>
                <button class="act-btn red" onclick="deleteDept(${d.id})">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function editDept(id, name, desc, email, threshold) {
    document.getElementById('deptFormCard').style.display = 'block';
    document.getElementById('deptFormTitle').textContent = 'Edit Department';
    document.getElementById('deptEditId').value = id;
    document.getElementById('deptName').value = name;
    document.getElementById('deptDesc').value = desc;
    document.getElementById('deptEmail').value = email || '';
    document.getElementById('deptThreshold').value = threshold || 10;
    document.getElementById('deptFormMsg').textContent = '';
    document.getElementById('deptFormCard').scrollIntoView({ behavior: 'smooth' });
}

async function deleteDept(id) {
    if (!confirm("Are you sure? All complaints in this department will be Unassigned.")) return;

    try {
        const res = await fetch('api/add_department.php', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete', id: id, is_admin: user.is_admin })
        });
        const json = await res.json();
        if (json.status === 'success') {
            departmentsData = await fetchDepartments();
            loadDepartmentsPanel();
        } else {
            alert(json.message);
        }
    } catch (e) { alert("Failed to delete."); }
}

async function sendManualAlert(id) {
    if (!confirm("Send a manual priority alert email to this department's officer?")) return;

    // Use event.target.closest to find the button even if emoji was clicked
    const btn = event.target.closest('button');
    const oldText = btn.innerHTML;
    btn.innerHTML = '⌛ Sending...'; btn.disabled = true;

    try {
        const res = await fetch('api/manual_alert.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ department_id: id, is_admin: user.is_admin })
        });
        const json = await res.json();
        if (json.status === 'success') {
            alert("✅ " + json.message);
        } else {
            alert("❌ " + json.message);
        }
    } catch (e) {
        alert("Error sending alert.");
    } finally {
        btn.innerHTML = oldText; btn.disabled = false;
    }
}
