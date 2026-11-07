/**
 * =====================================================================
 * FLOODROUTE - Citizen Waterlogging Reporting Script
 * Interactive coordinate picker, image preview, validations & submission
 * =====================================================================
 */

let reportMapInstance = null;
let reportPinMarker = null;
let uploadedPhotoBase64 = null;

const DEFAULT_HYD_CENTER = [17.3850, 78.4867];

document.addEventListener('DOMContentLoaded', () => {
  initReportMiniMap();
  setupReportForm();
  setupImageUpload();
  loadUserSubmissionHistory();
});

function initReportMiniMap() {
  const mapEl = document.getElementById('reportPickerMap');
  if (!mapEl) return;

  reportMapInstance = L.map('reportPickerMap', {
    center: DEFAULT_HYD_CENTER,
    zoom: 12
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(reportMapInstance);

  reportMapInstance.on('click', (e) => {
    setReportCoordinates(e.latlng.lat, e.latlng.lng);
  });

  // GPS Auto-locate
  const locateBtn = document.getElementById('btnReportLocateMe');
  if (locateBtn) {
    locateBtn.addEventListener('click', () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            setReportCoordinates(lat, lng);
            reportMapInstance.flyTo([lat, lng], 15);
            showToast('Current GPS coordinates detected', 'success');
          },
          () => showToast('Could not access current location', 'warning')
        );
      }
    });
  }
}

function setReportCoordinates(lat, lng) {
  const latInput = document.getElementById('reportLat');
  const lngInput = document.getElementById('reportLng');
  const coordsLabel = document.getElementById('reportCoordsText');

  if (latInput) latInput.value = lat.toFixed(6);
  if (lngInput) lngInput.value = lng.toFixed(6);
  if (coordsLabel) coordsLabel.textContent = `Selected: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;

  if (reportPinMarker && reportMapInstance) {
    reportMapInstance.removeLayer(reportPinMarker);
  }

  if (reportMapInstance) {
    reportPinMarker = L.marker([lat, lng], {
      icon: L.divIcon({ className: 'custom-pin pin-critical', html: '📍', iconSize: [28, 28] })
    }).addTo(reportMapInstance);
  }
}

function setupImageUpload() {
  const fileInput = document.getElementById('hazardPhotoInput');
  const dropzone = document.getElementById('photoDropzone');
  const previewContainer = document.getElementById('photoPreviewContainer');
  const previewImg = document.getElementById('photoPreviewImg');
  const removeBtn = document.getElementById('removePhotoBtn');

  if (!fileInput || !dropzone) return;

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handlePhotoFile(file);
  });

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('drag-over');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('drag-over');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    if (e.dataTransfer.files.length) {
      handlePhotoFile(e.dataTransfer.files[0]);
    }
  });

  if (removeBtn) {
    removeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      uploadedPhotoBase64 = null;
      fileInput.value = '';
      if (previewContainer) previewContainer.classList.remove('active');
    });
  }

  function handlePhotoFile(file) {
    if (!file.type.startsWith('image/')) {
      showToast('Please upload an image file (PNG, JPG, WebP)', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      uploadedPhotoBase64 = e.target.result;
      if (previewImg) previewImg.src = uploadedPhotoBase64;
      if (previewContainer) previewContainer.classList.add('active');
    };
    reader.readAsDataURL(file);
  }
}

function setupReportForm() {
  const form = document.getElementById('citizenReportForm');
  if (!form) return;

  // Auto-fill logged-in citizen name
  const user = FloodAPI.getCurrentUser();
  if (user && document.getElementById('reporterName')) {
    document.getElementById('reporterName').value = user.fullName || user.username;
  }

  // Pre-fill default coordinates for Tolichowki / Hyderabad
  setReportCoordinates(17.4011, 78.4124);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const locality = document.getElementById('reportLocality')?.value.trim();
    const hazardCategory = document.getElementById('hazardCategory')?.value;
    const waterDepthCm = parseFloat(document.getElementById('waterDepthCm')?.value);
    const severity = document.getElementById('reportSeverity')?.value;
    const lat = parseFloat(document.getElementById('reportLat')?.value);
    const lng = parseFloat(document.getElementById('reportLng')?.value);
    const landmark = document.getElementById('reportLandmark')?.value.trim();
    const description = document.getElementById('reportDescription')?.value.trim();
    const reporterName = document.getElementById('reporterName')?.value.trim() || 'Anonymous Citizen';
    const phone = document.getElementById('reporterPhone')?.value.trim() || '';

    // Validation
    if (!locality) {
      showToast('Please select or specify a locality', 'error');
      return;
    }
    if (isNaN(waterDepthCm) || waterDepthCm < 0) {
      showToast('Please enter a valid estimated water depth', 'error');
      return;
    }
    if (isNaN(lat) || isNaN(lng)) {
      showToast('Please select an exact location on the map', 'error');
      return;
    }

    const payload = {
      reporterName,
      phone,
      locality,
      landmark,
      latitude: lat,
      longitude: lng,
      hazardCategory,
      waterDepthCm,
      severity,
      description,
      imageUrl: uploadedPhotoBase64 || null
    };

    try {
      showToast('Submitting waterlogging report to GHMC persistence layer...', 'info');
      const saved = await FloodAPI.createReport(payload);

      // Show confirmation modal
      showConfirmationModal(saved);

      form.reset();
      if (document.getElementById('photoPreviewContainer')) {
        document.getElementById('photoPreviewContainer').classList.remove('active');
      }
      uploadedPhotoBase64 = null;

      loadUserSubmissionHistory();
    } catch (err) {
      showToast(`Submission failed: ${err.message}`, 'error');
    }
  });
}

function showConfirmationModal(report) {
  const modal = document.getElementById('reportConfirmModal');
  if (!modal) {
    showToast(`Report registered! Tracking UID: ${report.reportUid}`, 'success');
    return;
  }

  document.getElementById('modalReportUid').textContent = report.reportUid;
  document.getElementById('modalLocality').textContent = report.locality;
  document.getElementById('modalHazard').textContent = report.hazardCategory;
  document.getElementById('modalSeverity').textContent = report.severity;
  document.getElementById('modalStatus').textContent = report.status;

  modal.classList.add('active');

  const closeBtn = document.getElementById('closeModalBtn');
  if (closeBtn) {
    closeBtn.onclick = () => modal.classList.remove('active');
  }
}

async function loadUserSubmissionHistory() {
  const tbody = document.getElementById('myReportsTableBody');
  if (!tbody) return;

  const all = await FloodAPI.getReports();
  tbody.innerHTML = '';

  if (!all || all.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No past reports found.</td></tr>`;
    return;
  }

  all.slice(0, 6).forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${r.reportUid}</strong></td>
      <td class="cell-title">${r.locality}</td>
      <td>${r.hazardCategory}</td>
      <td>${r.waterDepthCm} cm</td>
      <td><span class="badge badge-${r.severity.toLowerCase()}">${r.severity}</span></td>
      <td><span class="badge badge-${r.status.toLowerCase().replace('_', '-')}">${r.status.replace('_', ' ')}</span></td>
    `;
    tbody.appendChild(tr);
  });
}
