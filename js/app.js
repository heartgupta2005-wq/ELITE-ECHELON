document.addEventListener('DOMContentLoaded', () => {
    
    // Auth State Management
    let currentUser = null;
    try {
        const stored = localStorage.getItem('civic_user');
        if (stored) currentUser = JSON.parse(stored);
    } catch (e) {
        console.error("Local storage error:", e);
    }

    // Dynamic Navigation
    const navLinksContainer = document.getElementById('navLinks');
    function renderNavigation() {
        if (currentUser) {
            navLinksContainer.innerHTML = `
                <button class="nav-btn" data-tab="dashboard-tab">Live Dashboard</button>
                <button class="nav-btn" data-tab="report-tab">Report Issue</button>
                <button class="nav-btn" data-tab="my-complaints-tab">My Complaints</button>
                <button class="nav-btn" data-tab="profile-tab">Profile</button>
                <button class="nav-btn" id="logoutBtn" style="color:var(--danger)">Logout</button>
            `;
            setTimeout(() => {
                document.getElementById('logoutBtn').addEventListener('click', () => {
                    localStorage.removeItem('civic_user');
                    currentUser = null;
                    renderNavigation();
                    switchTab('login-tab');
                });
            }, 0);
        } else {
            navLinksContainer.innerHTML = `
                <button class="nav-btn" data-tab="dashboard-tab">Live Dashboard</button>
                <button class="nav-btn active" data-tab="login-tab">Log In</button>
                <button class="nav-btn" data-tab="register-tab">Register</button>
            `;
        }
        setupTabListeners();
    }

    // Tab Switching Logic
    function switchTab(tabId) {
        const navBtns = document.querySelectorAll('.nav-btn, .nav-link-inline');
        const tabContents = document.querySelectorAll('.tab-content');
        
        navBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(t => t.classList.remove('active'));

        const targetNavBtn = document.querySelector(`.nav-btn[data-tab="${tabId}"]`);
        if (targetNavBtn) targetNavBtn.classList.add('active');
        
        const targetTab = document.getElementById(tabId);
        if (targetTab) {
            targetTab.classList.add('active');
        }

        // Contextual triggers
        if (tabId === 'dashboard-tab') loadComplaints();
        if (tabId === 'profile-tab') loadProfile();
        if (tabId === 'my-complaints-tab') loadMyComplaints();
        if (tabId === 'report-tab') {
            document.getElementById('user_id').value = currentUser ? currentUser.id : '';
        }
    }

    function setupTabListeners() {
        const navBtns = document.querySelectorAll('.nav-btn, .nav-link-inline');
        navBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                if(btn.id === 'logoutBtn') return;
                switchTab(btn.dataset.tab);
            });
        });
    }

    // Init App
    renderNavigation();
    switchTab(currentUser ? 'dashboard-tab' : 'login-tab');

    // --------------- AUTHENTICATION ---------------
    
    // Login
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = loginForm.querySelector('.submit-btn');
            const btnText = btn.querySelector('.btn-text');
            const loader = btn.querySelector('.loader');
            const msg = document.getElementById('loginMessage');
            
            btn.disabled = true; btnText.style.display = 'none'; loader.style.display = 'block';
            msg.className = 'form-message'; msg.textContent = '';

            try {
                const fd = new FormData(loginForm);
                const reqData = Object.fromEntries(fd.entries());
                
                const response = await fetch('api/login.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(reqData)
                });
                const result = await response.json();

                if (result.status === 'success') {
                    currentUser = result.data.user;
                    localStorage.setItem('civic_user', JSON.stringify(currentUser));
                    loginForm.reset();
                    renderNavigation();
                    switchTab('dashboard-tab');
                } else {
                    msg.textContent = result.message || "Login failed.";
                    msg.className = "form-message error";
                }
            } catch (err) {
                msg.textContent = "Network error.";
                msg.className = "form-message error";
            } finally {
                btn.disabled = false; btnText.style.display = 'block'; loader.style.display = 'none';
            }
        });
    }

    // Registration
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
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
                
                if (reqData.password.length < 6) {
                    throw new Error("Password too short.");
                }

                const response = await fetch('api/register.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(reqData)
                });
                const result = await response.json();

                if (result.status === 'success') {
                    msg.textContent = result.message;
                    msg.className = "form-message success";
                    registerForm.reset();
                    setTimeout(() => switchTab('login-tab'), 2000);
                } else {
                    msg.textContent = result.message || "Registration failed.";
                    msg.className = "form-message error";
                }
            } catch (err) {
                msg.textContent = err.message || "Network error.";
                msg.className = "form-message error";
            } finally {
                btn.disabled = false; btnText.style.display = 'block'; loader.style.display = 'none';
            }
        });
    }

    // --------------- PROFILE ---------------

    async function loadProfile() {
        if (!currentUser) return switchTab('login-tab');
        try {
            const resp = await fetch(`api/get_user.php?user_id=${currentUser.id}`);
            const res = await resp.json();
            if (res.status === 'success') {
                const u = res.data;
                document.getElementById('profName').textContent = u.name;
                document.getElementById('profEmail').textContent = u.email;
                document.getElementById('profPhone').textContent = u.phone;
                document.getElementById('profTotal').textContent = u.total_complaints;
                
                if (u.name) {
                    document.getElementById('profAvatar').textContent = u.name.charAt(0).toUpperCase();
                }
                if (u.created_at) {
                    const d = new Date(u.created_at);
                    document.getElementById('profJoined').textContent = d.toLocaleDateString(undefined, {month: 'short', year: 'numeric'});
                }
            }
        } catch (e) {
            console.error("Profile load failed.");
        }
    }

    // --------------- MY COMPLAINTS ---------------

    async function loadMyComplaints() {
        if (!currentUser) return switchTab('login-tab');
        const grid = document.getElementById('myComplaintsGrid');
        if (!grid) return;
        
        grid.innerHTML = '<div class="loading-state">Loading your personal complaints...</div>';
        
        try {
            const resp = await fetch(`api/get_user_complaints.php?user_id=${currentUser.id}`);
            const res = await resp.json();
            if (res.status === 'success') {
                renderComplaints(res.data, grid, true);
            } else {
                grid.innerHTML = `<div style="color:var(--danger)">${res.message}</div>`;
            }
        } catch (e) {
            grid.innerHTML = `<div style="color:var(--danger)">Failed to load.</div>`;
        }
    }

    // --------------- PUBLIC DASHBOARD & SUBMISSION UTILS ---------------

    // File Input Name display
    const fileInput = document.getElementById('image');
    const filePlaceholder = document.querySelector('.file-upload-placeholder span');
    if(fileInput && filePlaceholder) {
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                filePlaceholder.textContent = e.target.files[0].name;
            } else {
                filePlaceholder.textContent = 'Click or drag image to upload';
            }
        });
    }

    // Geolocation API 
    const getLocationBtn = document.getElementById('getLocationBtn');
    const locationStatus = document.getElementById('locationStatus');
    const latInput = document.getElementById('lat');
    const lngInput = document.getElementById('lng');

    if (getLocationBtn) {
        getLocationBtn.addEventListener('click', () => {
            if (!navigator.geolocation) {
                locationStatus.textContent = "Geolocation is not supported by your browser.";
                locationStatus.className = "location-status error";
                return;
            }

            locationStatus.textContent = "Locating...";
            locationStatus.className = "location-status";

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;
                    latInput.value = lat;
                    lngInput.value = lng;
                    locationStatus.textContent = `Location captured: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
                    locationStatus.className = "location-status success";
                },
                (error) => {
                    let errMsg = "Unable to retrieve location.";
                    if(error.code === 1) errMsg = "Location access denied by user.";
                    locationStatus.textContent = errMsg;
                    locationStatus.className = "location-status error";
                }
            );
        });
    }

    // Issue Submission
    const complaintForm = document.getElementById('complaintForm');
    const formMessage = document.getElementById('formMessage');

    if (complaintForm) {
        complaintForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if(!currentUser) {
                switchTab('login-tab');
                return;
            }
            
            const btn = complaintForm.querySelector('.submit-btn');
            const btnText = btn.querySelector('.btn-text');
            const loader = btn.querySelector('.loader');

            btn.disabled = true; btnText.style.display = 'none'; loader.style.display = 'block';
            formMessage.className = 'form-message'; formMessage.textContent = '';

            const formData = new FormData(complaintForm);
            
            // Safeguard if user_id is missing from DOM
            if(!formData.get('user_id')) formData.set('user_id', currentUser.id);

            try {
                const response = await fetch('api/submit_complaint.php', {
                    method: 'POST',
                    body: formData
                });
                const result = await response.json();
                
                if (result.status === 'success') {
                    formMessage.textContent = "Thank you! Your issue has been successfully reported.";
                    formMessage.className = "form-message success";
                    complaintForm.reset();
                    if(filePlaceholder) filePlaceholder.textContent = 'Click or drag image to upload';
                    if(locationStatus) {
                        locationStatus.textContent = 'Location not captured.';
                        locationStatus.className = 'location-status';
                    }
                    if(latInput) latInput.value = '';
                    if(lngInput) lngInput.value = '';
                    
                    setTimeout(() => {
                        switchTab('my-complaints-tab');
                    }, 1500);
                } else {
                    formMessage.textContent = result.message || "An error occurred.";
                    formMessage.className = "form-message error";
                }
            } catch (error) {
                formMessage.textContent = "Network error. Please try again later.";
                formMessage.className = "form-message error";
            } finally {
                btn.disabled = false; btnText.style.display = 'block'; loader.style.display = 'none';
            }
        });
    }

    // Public Dashboard
    const complaintsGrid = document.getElementById('complaintsGrid');
    const statusFilter = document.getElementById('statusFilter');

    if (statusFilter) {
        statusFilter.addEventListener('change', () => {
            loadComplaints();
        });
    }

    async function loadComplaints() {
        if (!complaintsGrid) return;
        complaintsGrid.innerHTML = '<div class="loading-state">Loading complaints...</div>';

        const status = statusFilter ? statusFilter.value : '';
        let url = 'api/get_complaints.php';
        if (status) url += `?status=${encodeURIComponent(status)}`;

        try {
            const response = await fetch(url);
            const result = await response.json();
            if (result.status === 'success') {
                renderComplaints(result.data, complaintsGrid, false);
            } else {
                complaintsGrid.innerHTML = `<div style="color:var(--danger)">Error: ${result.message}</div>`;
            }
        } catch (error) {
            complaintsGrid.innerHTML = `<div style="color:var(--danger)">Failed to load complaints.</div>`;
        }
    }

    function renderComplaints(complaints, container, isPersonal) {
        if (complaints.length === 0) {
            container.innerHTML = `<div>No complaints found.</div>`;
            return;
        }

        let html = '';
        complaints.forEach(item => {
            const badgeClass = item.status.replace(/\s+/g, '');
            const dept = item.department_name || 'Unassigned';
            const dateStr = new Date(item.created_at).toLocaleString();

            html += `
                <div class="glass-card complaint-card" onclick="openComplaintModal('${item.id}')">
                    <div class="complaint-id">${item.id}</div>
                    <div class="complaint-desc">${item.description}</div>
                    <div><span class="badge ${badgeClass}">${item.status}</span></div>
                    <div class="complaint-meta">
                        <strong>Dept:</strong> ${dept} &middot;
                        ${dateStr}
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
    }

    // Modal Logic
    const modal = document.getElementById('complaintModal');
    const modalBody = document.getElementById('modalBody');
    const closeModal = document.querySelector('.close-modal');

    if (closeModal) {
        closeModal.addEventListener('click', () => {
            modal.classList.remove('show');
        });
    }

    window.openComplaintModal = async function(id) {
        modal.classList.add('show');
        modalBody.innerHTML = '<div>Loading details...</div>';

        try {
            const response = await fetch(`api/get_complaint.php?id=${encodeURIComponent(id)}`);
            const result = await response.json();

            if (result.status === 'success') {
                const c = result.data.complaint;
                const timeline = result.data.timeline;
                const badgeClass = c.status.replace(/\s+/g, '');
                
                let detailsHtml = `
                    <h2 style="margin-bottom:0.5rem">Complaint ${c.id}</h2>
                    <div style="margin-bottom:1rem"><span class="badge ${badgeClass}">${c.status}</span></div>
                    <p style="margin-bottom: 1rem"><strong>Description:</strong><br>${c.description}</p>
                    <p style="margin-bottom: 1rem; color:var(--text-muted); font-size:0.9rem">
                        Location: ${c.lat ? c.lat + ', ' + c.lng : 'Not provided'}<br>
                        Department: ${c.department_name || 'Unassigned'}
                    </p>
                `;

                if (c.image_url) {
                    detailsHtml += `<div style="margin-bottom: 1rem;">
                        <img src="${c.image_url}" alt="Attachment" style="max-width:100%; border-radius:12px; box-shadow:0 4px 10px rgba(0,0,0,0.1)">
                    </div>`;
                }

                if (timeline && timeline.length > 0) {
                    detailsHtml += `<h3 style="margin-top: 2rem">Timeline logs</h3><div class="timeline">`;
                    timeline.forEach(log => {
                        detailsHtml += `
                            <div class="timeline-item">
                                <div class="timeline-date">${new Date(log.created_at).toLocaleString()}</div>
                                <div class="timeline-title">${log.event_type}</div>
                                <div class="timeline-desc">${log.description}</div>
                            </div>
                        `;
                    });
                    detailsHtml += `</div>`;
                }

                modalBody.innerHTML = detailsHtml;
            } else {
                modalBody.innerHTML = `<div style="color:var(--danger)">${result.message}</div>`;
            }
        } catch (err) {
            modalBody.innerHTML = `<div style="color:var(--danger)">Error fetching details.</div>`;
        }
    };
});
