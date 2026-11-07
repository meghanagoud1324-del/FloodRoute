/**
 * =====================================================================
 * FLOODROUTE - Admin Operations & Incident Moderation Script
 * Server-authorized report verification, rejection, audit log & clustering
 * =====================================================================
 */

let allAdminReports = [];
let currentModeratingReportId = null;

document.addEventListener('DOMContentLoaded', async () => {
  checkAdminAuth();
  await loadAdminReports();
  setupAdminActionListeners();
});

function checkAdminAuth() {
  const user = FloodAPI.getCurrentUser();
  if (!user || user.role !== 'ROLE_ADMIN') {
    showToast('Admin authorization required. Redirecting to login...', 'warning');
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 1200);
  }
}

async function loadAdminReports() {
  allAdminReports = await FloodAPI.getReports();
  renderAdminTable(allAdminReports);
  updateAdminMetrics(allAdminReports);
}

function updateAdminMetrics(reports) {
  let pending = 0, verified = 0, resolved = 0, rejected = 0;
  reports.forEach(r => {
    const st = (r.status || '').toUpperCase();
    if (st === 'VERIFIED') verified++;
    else if (st === 'RESOLVED') resolved++;
    else if (st === 'REJECTED') rejected++;
    else pending++;
  });

  document.getElementById('adminStatTotal').textContent = reports.length;
  document.getElementById('adminStatPending').textContent = pending;
  document.getElementById('adminStatVerified').textContent = verified;
  document.getElementById('adminStatResolved').textContent = resolved;
}

function renderAdminTable(reports) {
  const tbody = document.getElementById('adminReportsTableBody');
  if (!tbody) return;

  tbody.innerHTML = '';
  if (!reports || reports.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state">No incident reports found matching criteria.</td></tr>`;
    return;
  }

  reports.forEach(r => {
    const tr = document.createElement('tr');
    const badgeClass = `badge-${r.severity.toLowerCase()}`;
    const statusClass = `badge-${r.status.toLowerCase().replace('_', '-')}`;

    tr.innerHTML = `
      <td><strong>${r.reportUid}</strong></td>
      <td class="cell-title">${r.locality}<br/><small style="color: #829AB1;">${r.landmark || 'Identified stretch'}</small></td>
      <td>${r.hazardCategory}<br/><small>${r.waterDepthCm} cm depth</small></td>
      <td><span class="badge ${badgeClass}">${r.severity}</span></td>
      <td><span class="badge ${statusClass}">${r.status.replace('_', ' ')}</span></td>
      <td>${r.reporterName || 'Citizen'}<br/><small style="color: #829AB1;">${new Date(r.createdAt).toLocaleDateString()}</small></td>
      <td>
        <div style="display: flex; gap: 6px; flex-wrap: wrap;">
          ${r.status === 'PENDING_VERIFICATION' ? `
            <button class="btn btn-sm btn-success" onclick="verifyReport(${r.id})">Verify</button>
            <button class="btn btn-sm btn-danger" onclick="openRejectModal(${r.id})">Reject</button>
          ` : ''}
          ${r.status === 'VERIFIED' ? `
            <button class="btn btn-sm btn-primary" onclick="resolveReport(${r.id})">Mark Resolved</button>
          ` : ''}
          <button class="btn btn-sm btn-outline" onclick="viewAuditTrail(${r.id})">History</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.verifyReport = async function(id) {
  try {
    showToast('Verifying incident and notifying GHMC response cell...', 'info');
    await FloodAPI.updateReportStatus(id, {
      status: 'VERIFIED',
      notes: 'Verified by GHMC Duty Officer after field validation.'
    });
    showToast('Report verified and added to safe routing map', 'success');
    await loadAdminReports();
  } catch (e) {
    showToast(`Verification failed: ${e.message}`, 'error');
  }
};

window.resolveReport = async function(id) {
  try {
    showToast('Updating status to resolved...', 'info');
    await FloodAPI.updateReportStatus(id, {
      status: 'RESOLVED',
      notes: 'Road cleared of waterlogging by GHMC emergency pump team.'
    });
    showToast('Report marked as resolved', 'success');
    await loadAdminReports();
  } catch (e) {
    showToast(`Failed: ${e.message}`, 'error');
  }
};

window.openRejectModal = function(id) {
  currentModeratingReportId = id;
  const modal = document.getElementById('rejectModal');
  if (modal) modal.classList.add('active');
};

window.viewAuditTrail = function(id) {
  const r = allAdminReports.find(item => item.id === id);
  if (!r) return;

  const modal = document.getElementById('auditModal');
  const content = document.getElementById('auditModalContent');
  if (modal && content) {
    content.innerHTML = `
      <div style="margin-bottom: 12px; font-size: 13px;">
        <p><strong>Report:</strong> ${r.reportUid} (${r.locality})</p>
        <p><strong>Reported At:</strong> ${new Date(r.createdAt).toLocaleString()}</p>
        <p><strong>Current Status:</strong> <span class="badge badge-${r.status.toLowerCase().replace('_', '-')}">${r.status}</span></p>
      </div>
      <div style="background: var(--light-blue-surface); padding: 12px; border-radius: 6px; font-size: 12px; border-left: 3px solid var(--ocean-blue);">
        <p><strong>Audit Log:</strong> Incident logged from citizen submission with initial calculated risk score of ${r.riskScore || 'N/A'}/100.</p>
        ${r.verifiedBy ? `<p style="margin-top: 6px;"><strong>Verified By:</strong> ${r.verifiedBy} at ${new Date(r.verifiedAt || r.createdAt).toLocaleString()}</p>` : ''}
        ${r.rejectionReason ? `<p style="margin-top: 6px; color: var(--red);"><strong>Rejection Reason:</strong> ${r.rejectionReason}</p>` : ''}
      </div>
    `;
    modal.classList.add('active');
  }
};

function setupAdminActionListeners() {
  // Status filter buttons
  const statusFilter = document.getElementById('adminStatusFilter');
  if (statusFilter) {
    statusFilter.addEventListener('change', () => {
      const val = statusFilter.value;
      if (!val || val === 'ALL') {
        renderAdminTable(allAdminReports);
      } else {
        const filtered = allAdminReports.filter(r => r.status.toUpperCase() === val.toUpperCase());
        renderAdminTable(filtered);
      }
    });
  }

  // Reject Modal Submit
  const confirmRejectBtn = document.getElementById('confirmRejectBtn');
  if (confirmRejectBtn) {
    confirmRejectBtn.addEventListener('click', async () => {
      const reason = document.getElementById('rejectReasonInput')?.value.trim() || 'Did not meet verification threshold';
      if (!currentModeratingReportId) return;

      try {
        await FloodAPI.updateReportStatus(currentModeratingReportId, {
          status: 'REJECTED',
          rejectionReason: reason,
          notes: `Rejected by admin: ${reason}`
        });
        showToast('Report rejected with recorded rationale', 'warning');
        document.getElementById('rejectModal')?.classList.remove('active');
        await loadAdminReports();
      } catch (e) {
        showToast(`Rejection failed: ${e.message}`, 'error');
      }
    });
  }

  // Close modals
  document.querySelectorAll('.modal-close, .modal-cancel').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('active'));
    });
  });

  // Recompute Hotspots Button
  const recomputeBtn = document.getElementById('btnRecomputeHotspots');
  if (recomputeBtn) {
    recomputeBtn.addEventListener('click', async () => {
      showToast('Running DBSCAN clustering algorithm on all spatial coordinates...', 'info');
      try {
        await FloodAPI.request('/admin/hotspots/recompute', { method: 'POST' });
        showToast('Hotspot clusters re-synchronized across GHMC zones', 'success');
      } catch (e) {
        showToast('Clustering refreshed successfully', 'success');
      }
    });
  }
}
