document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('signatureCanvas');
    const clearBtn = document.getElementById('clearBtn');
    const saveBtn = document.getElementById('saveSignatureBtn');
    const ctx = canvas.getContext('2d');
    
    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;

    // Stylize drawing
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    function draw(e) {
        if (!isDrawing) return;
        
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(x, y);
        ctx.stroke();
        
        [lastX, lastY] = [x, y];
    }

    canvas.addEventListener('mousedown', (e) => {
        isDrawing = true;
        const rect = canvas.getBoundingClientRect();
        [lastX, lastY] = [e.clientX - rect.left, e.clientY - rect.top];
    });

    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', () => isDrawing = false);
    canvas.addEventListener('mouseout', () => isDrawing = false);

    // ── Touch Events ──
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        isDrawing = true;
        const rect = canvas.getBoundingClientRect();
        const touch = e.touches[0];
        [lastX, lastY] = [touch.clientX - rect.left, touch.clientY - rect.top];
    });

    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (!isDrawing) return;
        const rect = canvas.getBoundingClientRect();
        const touch = e.touches[0];
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;

        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(x, y);
        ctx.stroke();
        [lastX, lastY] = [x, y];
    });

    canvas.addEventListener('touchend', () => isDrawing = false);

    // Clear canvas
    clearBtn.onclick = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    // Save signature
    saveBtn.onclick = async () => {
        if (isCanvasEmpty()) {
            Toast.show('Please provide a signature', 'warning');
            return;
        }

        const dataURL = canvas.toDataURL('image/png');
        const blob = await (await fetch(dataURL)).blob();
        const formData = new FormData();
        formData.append('signature', blob, 'signature.png');

        try {
            const res = await fetch(`/contracts/${window.currentSigningId}/signature`, {
                method: 'POST',
                body: formData
            });

            if (res.ok) {
                document.getElementById('signatureModal').classList.remove('active');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                Toast.show('Signature applied successfully!', 'success');
                if (window.fetchContracts) window.fetchContracts();
                if (window.fetchStats) window.fetchStats();
            } else {
                const data = await res.json();
                Toast.show(data.error || 'Failed to save signature', 'error');
            }
        } catch (err) {
            console.error(err);
            Toast.show('An error occurred while saving signature', 'error');
        }
    };

    function isCanvasEmpty() {
        const blank = document.createElement('canvas');
        blank.width = canvas.width;
        blank.height = canvas.height;
        return canvas.toDataURL() === blank.toDataURL();
    }
});
