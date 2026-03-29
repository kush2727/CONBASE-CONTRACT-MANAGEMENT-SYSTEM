document.addEventListener('DOMContentLoaded', () => {
    // ── DOM References ───────────────────────────────────────────────
    const contractsGrid   = document.getElementById('contractsGrid');
    const searchInput     = document.getElementById('searchInput');
    const filterBtns      = document.querySelectorAll('.filter-btn');
    const uploadBtn       = document.getElementById('openUploadBtn');
    const uploadModal     = document.getElementById('uploadModal');
    const uploadForm      = document.getElementById('uploadForm');
    const editModal       = document.getElementById('editModal');
    const editForm        = document.getElementById('editForm');
    const dropZone        = document.getElementById('dropZone');
    const fileInput       = document.getElementById('fileInput');
    const fileNameDisplay = document.getElementById('fileNameDisplay');
    const loadingSpinner  = document.getElementById('loadingSpinner');
    const sortSelect      = document.getElementById('sortSelect');
    const startFrom       = document.getElementById('startFrom');
    const endTo           = document.getElementById('endTo');
    const exportCsvBtn    = document.getElementById('exportCsvBtn');
    const viewTitle       = document.getElementById('viewTitle');
    const navItems        = document.querySelectorAll('.nav-item');
    const pdfModal        = document.getElementById('pdfModal');
    const pdfFrame        = document.getElementById('pdfFrame');
    const pdfTitle        = document.getElementById('pdfTitle');
    const pdfDownloadBtn  = document.getElementById('pdfDownloadBtn');
    const mobileMenuBtn   = document.getElementById('mobileMenuBtn');
    const sidebar         = document.querySelector('.sidebar');
    const sidebarOverlay  = document.getElementById('sidebarOverlay');

    // ── State ────────────────────────────────────────────────────────
    let currentStatusFilter = '';
    let currentSearchQuery  = '';
    let isExpiringSoonView  = false;
    let allContracts        = [];
    let statusChart         = null;

    // ── Init ─────────────────────────────────────────────────────────
    fetchContracts();
    fetchStats();

    // ── Modal helpers ─────────────────────────────────────────────────
    function openModal(modal)  { modal.classList.add('active'); }
    function closeModal(modal) { modal.classList.remove('active'); }

    // ── Mobile Navigation ─────────────────────────────────────────────
    if (mobileMenuBtn) {
        mobileMenuBtn.onclick = () => {
            sidebar.classList.toggle('active');
            sidebarOverlay.classList.toggle('active');
        };
    }

    if (sidebarOverlay) {
        sidebarOverlay.onclick = () => {
            sidebar.classList.remove('active');
            sidebarOverlay.classList.remove('active');
        };
    }

    document.querySelectorAll('.close-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.modal').forEach(m => closeModal(m));
        };
    });

    // ── Sidebar Navigation ────────────────────────────────────────────
    function setActiveNav(el) {
        navItems.forEach(i => i.classList.remove('active'));
        el.classList.add('active');
        sidebar.classList.remove('active');
        sidebarOverlay.classList.remove('active');
    }

    document.getElementById('navDashboard').onclick = (e) => {
        e.preventDefault();
        setActiveNav(e.currentTarget);
        currentStatusFilter = '';
        isExpiringSoonView  = false;
        viewTitle.textContent = 'Contract Dashboard';
        fetchContracts();
    };

    document.getElementById('navAllContracts').onclick = (e) => {
        e.preventDefault();
        setActiveNav(e.currentTarget);
        currentStatusFilter = '';
        isExpiringSoonView  = false;
        viewTitle.textContent = 'All Contracts';
        fetchContracts();
    };

    document.getElementById('navExpiringSoon').onclick = (e) => {
        e.preventDefault();
        setActiveNav(e.currentTarget);
        currentStatusFilter = 'Active';
        isExpiringSoonView  = true;
        viewTitle.textContent = 'Contracts Expiring Soon';
        fetchContracts();
    };

    // ── Status Filter Buttons ─────────────────────────────────────────
    filterBtns.forEach(btn => {
        btn.onclick = () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentStatusFilter = btn.dataset.status;
            isExpiringSoonView  = false;
            fetchContracts();
        };
    });

    // ── Search ────────────────────────────────────────────────────────
    searchInput.oninput = (e) => {
        currentSearchQuery = e.target.value;
        fetchContracts();
    };

    // ── Sorting & Date Filters ────────────────────────────────────────
    sortSelect.onchange  = () => fetchContracts();
    startFrom.onchange   = () => fetchContracts();
    endTo.onchange       = () => fetchContracts();

    // ── Upload Modal ──────────────────────────────────────────────────
    uploadBtn.onclick = () => openModal(uploadModal);

    dropZone.onclick = () => fileInput.click();
    fileInput.onchange = (e) => {
        if (e.target.files.length > 0) {
            fileNameDisplay.textContent = e.target.files[0].name;
            dropZone.classList.add('has-file');
        }
    };

    uploadForm.onsubmit = async (e) => {
        e.preventDefault();
        const formData = new FormData(uploadForm);

        try {
            const res  = await fetch('/contracts', { method: 'POST', body: formData });
            const data = await res.json();

            if (res.ok) {
                closeModal(uploadModal);
                uploadForm.reset();
                fileNameDisplay.textContent = '';
                dropZone.classList.remove('has-file');
                fetchContracts();
                fetchStats();
                Toast.show('Contract created successfully!', 'success');
            } else {
                Toast.show(data.error || 'Upload failed', 'error');
            }
        } catch (err) {
            console.error(err);
            Toast.show('An error occurred during upload', 'error');
        }
    };

    // ── Edit Modal ────────────────────────────────────────────────────
    editForm.onsubmit = async (e) => {
        e.preventDefault();
        const id = document.getElementById('editContractId').value;
        const payload = {
            contract_name: document.getElementById('editName').value,
            party_name:    document.getElementById('editPartyName').value,
            start_date:    document.getElementById('editStartDate').value,
            end_date:      document.getElementById('editEndDate').value,
        };

        try {
            const res = await fetch(`/contracts/${id}`, {
                method:  'PUT',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify(payload),
            });

            if (res.ok) {
                closeModal(editModal);
                fetchContracts();
                fetchStats();
                Toast.show('Contract updated successfully!', 'success');
            } else {
                const data = await res.json();
                Toast.show(data.error || 'Update failed', 'error');
            }
        } catch (err) {
            console.error(err);
            Toast.show('An error occurred during update', 'error');
        }
    };

    // ── Export CSV ────────────────────────────────────────────────────
    exportCsvBtn.onclick = () => {
        if (allContracts.length === 0) {
            Toast.show('No data to export', 'warning');
            return;
        }

        const headers = ['ID', 'Name', 'Party', 'Start Date', 'End Date', 'Status'];
        const rows = allContracts.map(c => [
            c.id,
            `"${c.contract_name}"`,
            `"${c.party_name}"`,
            c.start_date,
            c.end_date,
            c.status,
        ]);

        const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `contracts_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);

        Toast.show('Exported successfully!', 'success');
    };

    // ── Fetch & Render Contracts ──────────────────────────────────────
    async function fetchContracts() {
        loadingSpinner.style.display = 'flex';
        contractsGrid.innerHTML = '';

        const params = new URLSearchParams({
            search:        currentSearchQuery,
            status:        currentStatusFilter,
            expiring_soon: isExpiringSoonView,
            sort_by:       sortSelect.value,
            start_from:    startFrom.value,
            end_to:        endTo.value,
        });

        try {
            const res       = await fetch(`/contracts?${params}`);
            const contracts = await res.json();

            loadingSpinner.style.display = 'none';
            allContracts = contracts;

            if (contracts.length === 0) {
                contractsGrid.innerHTML = `
                    <div class="empty-state">
                        <img src="/static/img/empty-state.png" alt="No contracts found">
                        <h2>No contracts found</h2>
                        <p>Try adjusting your search or filters, or create sample data to explore the dashboard.</p>
                        <button class="btn btn-primary" onclick="createSampleData()">
                            <i class="fas fa-magic"></i> Create Sample Contracts
                        </button>
                    </div>`;
                return;
            }

            contracts.forEach(c => contractsGrid.appendChild(createContractCard(c)));
        } catch (err) {
            console.error(err);
            loadingSpinner.style.display = 'none';
            contractsGrid.innerHTML = '<p style="color:red;padding:2rem;">Failed to load contracts. Is the server running?</p>';
        }
    }

    // ── Fetch Stats & Update Chart ────────────────────────────────────
    async function fetchStats() {
        try {
            const res   = await fetch('/contracts/stats');
            const stats = await res.json();

            document.getElementById('statTotal').textContent    = stats.total;
            document.getElementById('statActive').textContent   = stats.active;
            document.getElementById('statExpiring').textContent = stats.expiring_soon;

            updateChart(stats);
        } catch (err) {
            console.error('Failed to fetch stats:', err);
        }
    }

    function updateChart(stats) {
        const canvas = document.getElementById('statusChart');
        if (!canvas) return;

        if (statusChart) statusChart.destroy();

        statusChart = new Chart(canvas.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['Active', 'Expired'],
                datasets: [{
                    data: [stats.active, stats.expired],
                    backgroundColor: ['#10B981', '#EF4444'],
                    borderWidth: 0,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '72%',
                animation: {
                    animateScale: true,
                    animateRotate: true,
                    duration: 1000,
                    easing: 'easeOutQuart'
                },
                plugins: { 
                    legend: { display: false }, 
                    tooltip: { 
                        enabled: true,
                        backgroundColor: '#111827',
                        titleFont: { family: 'Outfit', size: 13 },
                        bodyFont: { family: 'Outfit', size: 12 },
                        padding: 10,
                        cornerRadius: 8,
                        displayColors: false
                    } 
                },
            },
        });
    }

    // ── Contract Card ─────────────────────────────────────────────────
    function createContractCard(c) {
        const div = document.createElement('div');
        div.className = 'contract-card';

        const expiryBadge = c.is_expiring_soon
            ? `<span class="expiry-badge"><i class="fas fa-exclamation-triangle"></i> ${c.days_left}d left</span>`
            : '';

        div.innerHTML = `
            <div class="card-header">
                <div>
                    <h3>${escapeHtml(c.contract_name)}</h3>
                    <span class="status-badge ${c.status.toLowerCase()}">${c.status}</span>
                    ${expiryBadge}
                </div>
                <div class="card-actions">
                    <button class="btn-icon" title="Edit" onclick="openEditModal(${c.id})"><i class="fas fa-edit"></i></button>
                    <button class="btn-icon" title="Delete" onclick="deleteContract(${c.id})"><i class="fas fa-trash"></i></button>
                    <button class="btn-icon" title="Preview PDF" onclick="openPdfViewer('${c.file_path}', '${escapeHtml(c.contract_name)}')"><i class="fas fa-file-pdf"></i></button>
                </div>
            </div>
            <div class="card-body">
                <div class="party-info"><i class="fas fa-building"></i> ${escapeHtml(c.party_name)}</div>
                <div class="date-info">
                    <span><i class="fas fa-calendar-alt"></i> ${c.start_date}</span>
                    <span>→</span>
                    <span><i class="fas fa-calendar-check"></i> ${c.end_date}</span>
                </div>
                ${c.signature_path
                    ? `<div class="signature-display"><small><i class="fas fa-pen-nib"></i> Signed</small>
                       <img src="/static/${c.signature_path}" alt="Signature" style="height:30px;display:block;margin-top:4px;"></div>`
                    : `<div class="signature-prompt">
                       <button class="btn btn-secondary btn-small" onclick="openSignatureModal(${c.id})">
                           <i class="fas fa-pen"></i> Add Signature
                       </button></div>`
                }
            </div>`;
        return div;
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // ── Global Actions ────────────────────────────────────────────────
    window.deleteContract = (id) => {
        Confirm.show(
            'Delete Contract',
            'This will permanently delete the contract and its files. Are you sure?',
            async () => {
                try {
                    const res = await fetch(`/contracts/${id}`, { method: 'DELETE' });
                    if (res.ok) {
                        fetchContracts();
                        fetchStats();
                        Toast.show('Contract deleted successfully', 'success');
                    } else {
                        Toast.show('Failed to delete contract', 'error');
                    }
                } catch (err) {
                    console.error(err);
                    Toast.show('An error occurred', 'error');
                }
            }
        );
    };

    window.openEditModal = async (id) => {
        try {
            const res = await fetch(`/contracts/${id}`);
            const c   = await res.json();
            document.getElementById('editContractId').value = c.id;
            document.getElementById('editName').value        = c.contract_name;
            document.getElementById('editPartyName').value   = c.party_name;
            document.getElementById('editStartDate').value   = c.start_date;
            document.getElementById('editEndDate').value     = c.end_date;
            openModal(editModal);
        } catch (err) {
            Toast.show('Failed to load contract details', 'error');
        }
    };

    window.openSignatureModal = (id) => {
        window.currentSigningId = id;
        openModal(document.getElementById('signatureModal'));
    };

    // ── Toast Notification ────────────────────────────────────────────
    window.Toast = {
        show(message, type = 'info') {
            const container = document.getElementById('toastContainer');
            if (!container) return;

            const iconMap = {
                success: 'fa-check-circle',
                error:   'fa-exclamation-circle',
                warning: 'fa-exclamation-triangle',
                info:    'fa-info-circle',
            };

            const toast = document.createElement('div');
            toast.className = `toast ${type}`;
            toast.innerHTML = `<i class="fas ${iconMap[type] || iconMap.info}"></i><span>${message}</span>`;
            container.appendChild(toast);

            setTimeout(() => {
                toast.classList.add('fade-out');
                setTimeout(() => toast.remove(), 350);
            }, 3500);
        },
    };

    // ── Confirm Dialog ────────────────────────────────────────────────
    window.Confirm = {
        _cb:   null,
        modal: document.getElementById('confirmModal'),

        show(title, message, callback) {
            this._cb = callback;
            document.getElementById('confirmTitle').textContent   = title;
            document.getElementById('confirmMessage').textContent = message;
            openModal(this.modal);
        },
        hide() {
            closeModal(this.modal);
            this._cb = null;
        },
    };

    document.getElementById('confirmCancelBtn').onclick = () => Confirm.hide();
    document.getElementById('confirmOkBtn').onclick = () => {
        if (Confirm._cb) Confirm._cb();
        Confirm.hide();
    };

    // ── PDF Viewer Logic ──
    window.openPdfViewer = (filePath, name) => {
        const fullUrl = `/static/${filePath}`;
        pdfTitle.textContent = name;
        pdfFrame.src = fullUrl;
        pdfDownloadBtn.href = fullUrl;
        pdfDownloadBtn.download = name.endsWith('.pdf') ? name : `${name}.pdf`;
        openModal(pdfModal);
    };

    // ── Demo Seeding Logic ──
    window.createSampleData = async () => {
        Toast.show('Creating sample data...', 'info');
        try {
            const res = await fetch('/contracts/seed', { method: 'POST' });
            if (res.ok) {
                Toast.show('Sample contracts created!', 'success');
                fetchContracts();
                fetchStats();
            } else {
                Toast.show('Failed to seed data', 'error');
            }
        } catch (err) {
            console.error(err);
            Toast.show('An error occurred during seeding', 'error');
        }
    };
});
