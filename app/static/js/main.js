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

    // ── Local Storage Manager ─────────────────────────────────────────
    const Storage = {
        KEY: 'conbase_contracts_v1',
        getAll() {
            return JSON.parse(localStorage.getItem(this.KEY) || '[]');
        },
        saveAll(contracts) {
            localStorage.setItem(this.KEY, JSON.stringify(contracts));
        },
        add(contract) {
            const all = this.getAll();
            contract.id = Date.now(); // Simple unique ID
            contract.created_at = new Date().toISOString();
            all.unshift(contract);
            this.saveAll(all);
            return contract;
        },
        update(id, data) {
            const all = this.getAll();
            const idx = all.findIndex(c => c.id == id);
            if (idx !== -1) {
                all[idx] = { ...all[idx], ...data };
                this.saveAll(all);
                return all[idx];
            }
            return null;
        },
        delete(id) {
            const all = this.getAll().filter(c => c.id != id);
            this.saveAll(all);
        }
    };

    // ── State ────────────────────────────────────────────────────────
    let currentStatusFilter = '';
    let currentSearchQuery  = '';
    let isExpiringSoonView  = false;
    let allContractsCached  = [];
    let statusChart         = null;

    // ── Init ─────────────────────────────────────────────────────────
    refreshUI();

    // ── Modal helpers ─────────────────────────────────────────────────
    function openModal(modal)  { modal.classList.add('active'); }
    function closeModal(modal) { modal.classList.remove('active'); }

    document.querySelectorAll('.close-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.modal').forEach(m => closeModal(m));
        };
    });

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
        refreshUI();
    };

    document.getElementById('navAllContracts').onclick = (e) => {
        e.preventDefault();
        setActiveNav(e.currentTarget);
        currentStatusFilter = '';
        isExpiringSoonView  = false;
        viewTitle.textContent = 'All Contracts';
        refreshUI();
    };

    document.getElementById('navExpiringSoon').onclick = (e) => {
        e.preventDefault();
        setActiveNav(e.currentTarget);
        currentStatusFilter = 'Active';
        isExpiringSoonView  = true;
        viewTitle.textContent = 'Contracts Expiring Soon';
        refreshUI();
    };

    // ── Status Filter Buttons ─────────────────────────────────────────
    filterBtns.forEach(btn => {
        btn.onclick = () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentStatusFilter = btn.dataset.status;
            isExpiringSoonView  = false;
            refreshUI();
        };
    });

    // ── Search ────────────────────────────────────────────────────────
    searchInput.oninput = (e) => {
        currentSearchQuery = e.target.value.toLowerCase();
        refreshUI();
    };

    // ── Sorting & Date Filters ────────────────────────────────────────
    sortSelect.onchange  = () => refreshUI();
    startFrom.onchange   = () => refreshUI();
    endTo.onchange       = () => refreshUI();

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
        const file = fileInput.files[0];
        if (!file) return;

        Toast.show('Processing document...', 'info');

        const reader = new FileReader();
        reader.onload = (event) => {
            const contract = {
                contract_name: uploadForm.contract_name.value,
                party_name:    uploadForm.party_name.value,
                start_date:    uploadForm.start_date.value,
                end_date:      uploadForm.end_date.value,
                file_data:     event.target.result, // Base64
                file_name:     file.name,
                status:        computeStatus(uploadForm.end_date.value),
                signature_data: null
            };

            Storage.add(contract);
            closeModal(uploadModal);
            uploadForm.reset();
            fileNameDisplay.textContent = '';
            dropZone.classList.remove('has-file');
            refreshUI();
            Toast.show('Contract created successfully!', 'success');
        };
        reader.readAsDataURL(file);
    };

    // ── Edit Modal ────────────────────────────────────────────────────
    editForm.onsubmit = (e) => {
        e.preventDefault();
        const id = document.getElementById('editContractId').value;
        const endDate = document.getElementById('editEndDate').value;
        const payload = {
            contract_name: document.getElementById('editName').value,
            party_name:    document.getElementById('editPartyName').value,
            start_date:    document.getElementById('editStartDate').value,
            end_date:      endDate,
            status:        computeStatus(endDate)
        };

        Storage.update(id, payload);
        closeModal(editModal);
        refreshUI();
        Toast.show('Contract updated successfully!', 'success');
    };

    // ── UI Refresh Logic ──────────────────────────────────────────────
    function refreshUI() {
        const contracts = Storage.getAll();
        
        // Apply Filter Logic
        let filtered = contracts.filter(c => {
            const matchesSearch = c.contract_name.toLowerCase().includes(currentSearchQuery) || 
                                  c.party_name.toLowerCase().includes(currentSearchQuery);
            const matchesStatus = currentStatusFilter === '' || c.status === currentStatusFilter;
            
            // Date range filter
            const startDateObj = c.start_date ? new Date(c.start_date) : null;
            const endDateObj   = c.end_date ? new Date(c.end_date) : null;
            const filterStart  = startFrom.value ? new Date(startFrom.value) : null;
            const filterEnd    = endTo.value ? new Date(endTo.value) : null;
            
            const matchesStart = !filterStart || (startDateObj && startDateObj >= filterStart);
            const matchesEnd   = !filterEnd || (endDateObj && endDateObj <= filterEnd);

            // Expiring Soon logic (Manual calc since no backend)
            let matchesExpiring = true;
            if (isExpiringSoonView) {
                const daysLeft = getDaysLeft(c.end_date);
                matchesExpiring = c.status === 'Active' && daysLeft >= 0 && daysLeft <= 30;
            }

            return matchesSearch && matchesStatus && matchesStart && matchesEnd && matchesExpiring;
        });

        // Apply Sorting
        filtered.sort((a, b) => {
            switch(sortSelect.value) {
                case 'newest': return b.id - a.id;
                case 'oldest': return a.id - b.id;
                case 'name': return a.contract_name.localeCompare(b.contract_name);
                case 'expiry': return new Date(a.end_date) - new Date(b.end_date);
                default: return 0;
            }
        });

        allContractsCached = filtered;
        renderContracts(filtered);
        updateStats(contracts); // Stats should usually reflect global state or filtered? Let's do global.
    }

    function renderContracts(contracts) {
        contractsGrid.innerHTML = '';
        if (contracts.length === 0) {
            contractsGrid.innerHTML = `
                <div class="empty-state">
                    <img src="app/static/img/empty-state.png" alt="No contracts found">
                    <h2>No contracts found</h2>
                    <p>Try adjusting your search or filters, or create sample data to explore the dashboard.</p>
                    <button class="btn btn-primary" id="seedBtn">
                        <i class="fas fa-magic"></i> Create Sample Contracts
                    </button>
                </div>`;
            document.getElementById('seedBtn').onclick = createSampleData;
            return;
        }

        contracts.forEach(c => {
            const card = createContractCard(c);
            contractsGrid.appendChild(card);
        });
    }

    function createContractCard(c) {
        const div = document.createElement('div');
        div.className = 'contract-card';
        const daysLeft = getDaysLeft(c.end_date);
        const isExpiringSoon = c.status === 'Active' && daysLeft >= 0 && daysLeft <= 30;

        const expiryBadge = isExpiringSoon
            ? `<span class="expiry-badge"><i class="fas fa-exclamation-triangle"></i> ${daysLeft}d left</span>`
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
                    <button class="btn-icon" title="Preview PDF" onclick="openPdfViewer(${c.id})"><i class="fas fa-file-pdf"></i></button>
                </div>
            </div>
            <div class="card-body">
                <div class="party-info"><i class="fas fa-building"></i> ${escapeHtml(c.party_name)}</div>
                <div class="date-info">
                    <span><i class="fas fa-calendar-alt"></i> ${c.start_date}</span>
                    <span>→</span>
                    <span><i class="fas fa-calendar-check"></i> ${c.end_date}</span>
                </div>
                ${c.signature_data
                    ? `<div class="signature-display"><small><i class="fas fa-pen-nib"></i> Signed</small>
                       <img src="${c.signature_data}" alt="Signature" style="height:30px;display:block;margin-top:4px;"></div>`
                    : `<div class="signature-prompt">
                       <button class="btn btn-secondary btn-small" onclick="openSignatureModal(${c.id})">
                           <i class="fas fa-pen"></i> Add Signature
                       </button></div>`
                }
            </div>`;
        return div;
    }

    // ── Stats Logic ───────────────────────────────────────────────────
    function updateStats(all) {
        const active = all.filter(c => c.status === 'Active').length;
        const expired = all.filter(c => c.status === 'Expired').length;
        const expiringSoon = all.filter(c => {
            const daysLeft = getDaysLeft(c.end_date);
            return c.status === 'Active' && daysLeft >= 0 && daysLeft <= 30;
        }).length;

        document.getElementById('statTotal').textContent    = all.length;
        document.getElementById('statActive').textContent   = active;
        document.getElementById('statExpiring').textContent = expiringSoon;

        renderChart(active, expired);
    }

    function renderChart(active, expired) {
        const canvas = document.getElementById('statusChart');
        if (!canvas) return;
        if (statusChart) statusChart.destroy();

        statusChart = new Chart(canvas.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['Active', 'Expired'],
                datasets: [{
                    data: [active || 0, expired || 0],
                    backgroundColor: ['#10B981', '#EF4444'],
                    borderWidth: 0,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '72%',
                animation: { animateScale: true, animateRotate: true },
                plugins: { legend: { display: false } },
            },
        });
    }

    // ── Helper Utilities ──────────────────────────────────────────────
    function computeStatus(endDateStr) {
        const end = new Date(endDateStr);
        const today = new Date();
        today.setHours(0,0,0,0);
        return end >= today ? 'Active' : 'Expired';
    }

    function getDaysLeft(endDateStr) {
        const end = new Date(endDateStr);
        const today = new Date();
        today.setHours(0,0,0,0);
        const diff = end - today;
        return Math.floor(diff / (1000 * 60 * 60 * 24));
    }

    function escapeHtml(str) {
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // ── Export CSV ────────────────────────────────────────────────────
    exportCsvBtn.onclick = () => {
        if (allContractsCached.length === 0) {
            Toast.show('No data to export', 'warning');
            return;
        }
        const headers = ['ID', 'Name', 'Party', 'Start Date', 'End Date', 'Status'];
        const rows = allContractsCached.map(c => [c.id, `"${c.contract_name}"`, `"${c.party_name}"`, c.start_date, c.end_date, c.status]);
        const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url; a.download = `conbase_export_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        Toast.show('Exported successfully!', 'success');
    };

    // ── PDF Viewer ────────────────────────────────────────────────────
    window.openPdfViewer = (id) => {
        const c = Storage.getAll().find(item => item.id == id);
        if (!c) return;
        pdfTitle.textContent = c.contract_name;
        pdfFrame.src = c.file_data; // This is a Base64 string
        pdfDownloadBtn.href = c.file_data;
        pdfDownloadBtn.download = c.file_name || 'document.pdf';
        openModal(pdfModal);
    };

    // ── Global Edit/Delete ─────────────────────────────────────────────
    window.deleteContract = (id) => {
        Confirm.show('Delete Contract', 'Are you sure you want to delete this contract?', () => {
            Storage.delete(id);
            refreshUI();
            Toast.show('Contract deleted', 'success');
        });
    };

    window.openEditModal = (id) => {
        const c = Storage.getAll().find(item => item.id == id);
        if (!c) return;
        document.getElementById('editContractId').value = c.id;
        document.getElementById('editName').value = c.contract_name;
        document.getElementById('editPartyName').value = c.party_name;
        document.getElementById('editStartDate').value = c.start_date;
        document.getElementById('editEndDate').value = c.end_date;
        openModal(editModal);
    };

    window.openSignatureModal = (id) => {
        window.currentSigningId = id;
        openModal(document.getElementById('signatureModal'));
    };

    // ── Toast & Confirm ───────────────────────────────────────────────
    window.Toast = {
        show(message, type = 'info') {
            const container = document.getElementById('toastContainer');
            const toast = document.createElement('div');
            toast.className = `toast ${type}`;
            toast.innerHTML = `<span>${message}</span>`;
            container.appendChild(toast);
            setTimeout(() => { toast.classList.add('fade-out'); setTimeout(() => toast.remove(), 350); }, 3000);
        }
    };

    window.Confirm = {
        _cb: null,
        modal: document.getElementById('confirmModal'),
        show(title, message, cb) {
            this._cb = cb;
            document.getElementById('confirmTitle').textContent = title;
            document.getElementById('confirmMessage').textContent = message;
            openModal(this.modal);
        },
        hide() { closeModal(this.modal); this._cb = null; }
    };
    document.getElementById('confirmCancelBtn').onclick = () => Confirm.hide();
    document.getElementById('confirmOkBtn').onclick = () => { if(Confirm._cb) Confirm._cb(); Confirm.hide(); };

    // ── Seeding ───────────────────────────────────────────────────────
    function createSampleData() {
        Toast.show('Generating static sample data...', 'info');
        // Very minimal 1-pixel PDF Base64 string for demo purposes
        const samplePdf = 'data:application/pdf;base64,JVBERi0xLjcKWrO8u7q8Ci0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0KMSAwIG9iagogIDw8IC9UeXBlIC9DYXRhbG9nIC9QYWdlcyAyIDAgUiA+PgplbmRvYmoKMiAwIG9iagogIDw8IC9UeXBlIC9QYWdlcyAvS2lkcyBbMyAwIFJdIC9Db3VudCAxID4+CmVuZG9iagozIDAgb2JqCiAgPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSAvUmVzb3VyY2VzIDw8ID4+IC9Db250ZW50cyA0IDAgUiA+PgplbmRvYmoKNCAwIG9iagogIDw8IC9MZW5ndGggNTEgPj4Kc3RyZWFtCkJUCiAgL0YxIDI0IFRmCiAgNzIgNzIwIFRkCiAgKFNhbXBsZSBDb250cmFjdCBEb2N1bWVudCAtIENPTkJBU0UpIFRqCkVUCmVuZHN0cmVhbQplbmRvYmoKeHJlZgowIDUKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDE1IDAwMDAwIG4gCjAwMDAwMDAwNjAgMDAwMDAgbiAKMDAwMDAwMDExMiAwMDAwMCBuIAowMDAwMDAwMjM1IDAwMDAwIG4gCnRyYWlsZXIKICA8PCAvU2l6ZSA1IC9Sb290IDEgMCBSID4+CnN0YXJ0eHJlZgozMzgKJSVFT0Y=';
        
        const samples = [
            { contract_name: 'Software License Agreement', party_name: 'TechFlow Inc.', start_date: '2025-01-01', end_date: '2026-12-31', file_data: samplePdf, file_name: 'license.pdf', status: 'Active', signature_data: null },
            { contract_name: 'Office Lease 2025', party_name: 'MainStreet Properties', start_date: '2024-06-01', end_date: '2025-05-31', file_data: samplePdf, file_name: 'lease.pdf', status: 'Active', signature_data: null },
            { contract_name: 'Consulting Services SOP', party_name: 'Strategy Partners', start_date: '2023-01-01', end_date: '2024-01-01', file_data: samplePdf, file_name: 'sop.pdf', status: 'Expired', signature_data: null }
        ];

        samples.forEach(s => Storage.add(s));
        refreshUI();
        Toast.show('Sample data ready!', 'success');
    }
    
    // Externalize for signature.js
    window.onSignatureCaptured = (base64) => {
        if (window.currentSigningId) {
            Storage.update(window.currentSigningId, { signature_data: base64 });
            refreshUI();
            closeModal(document.getElementById('signatureModal'));
            Toast.show('Signature applied!', 'success');
        }
    };
});
