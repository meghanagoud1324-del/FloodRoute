/**
 * =====================================================================
 * FLOODROUTE - Interactive Hyderabad Flood Map
 * Built with Leaflet.js, OpenStreetMap, and Turf.js
 * =====================================================================
 */

let mapInstance = null;
let markersLayerGroup = null;
let zonesLayerGroup = null;
let allReportsCache = [];
let allHotspotsCache = [];
let selectedPinMarker = null;

const HYDERABAD_CENTER = [17.3850, 78.4867];

document.addEventListener('DOMContentLoaded', async () => {
  initMap();
  await loadMapData();
  setupMapControls();
});

function initMap() {
  const mapEl = document.getElementById('floodMap');
  if (!mapEl) return;

  // Initialize Leaflet Map centered on Hyderabad GHMC
  mapInstance = L.map('floodMap', {
    center: HYDERABAD_CENTER,
    zoom: 12,
    zoomControl: false
  });

  // Add Zoom control at top right
  L.control.zoom({ position: 'topright' }).addTo(mapInstance);

  // Add OpenStreetMap Tile Layer
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors | GHMC Hyderabad'
  }).addTo(mapInstance);

  markersLayerGroup = L.layerGroup().addTo(mapInstance);
  zonesLayerGroup = L.layerGroup().addTo(mapInstance);

  // Click on map to drop pin or select location
  mapInstance.on('click', (e) => {
    handleMapClick(e.latlng.lat, e.latlng.lng);
  });
}

async function loadMapData() {
  allReportsCache = await FloodAPI.getReports();
  allHotspotsCache = await FloodAPI.getHotspots();

  renderMarkers(allReportsCache);
  renderHotspotZones(allHotspotsCache);
  renderIncidentList(allReportsCache);
}

function renderMarkers(reports) {
  if (!markersLayerGroup) return;
  markersLayerGroup.clearLayers();

  reports.forEach(report => {
    const lat = parseFloat(report.latitude);
    const lng = parseFloat(report.longitude);
    if (isNaN(lat) || isNaN(lng)) return;

    const sev = report.severity ? report.severity.toUpperCase() : 'MODERATE';
    const pinClass = `pin-${sev.toLowerCase()}`;
    const iconLetter = sev.charAt(0);

    const customIcon = L.divIcon({
      className: `custom-pin ${pinClass}`,
      html: `<span>${iconLetter}</span>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      popupAnchor: [0, -14]
    });

    const marker = L.marker([lat, lng], { icon: customIcon });

    // Popup Content
    const popupHtml = `
      <div class="popup-card">
        <div class="popup-header">
          <span class="popup-title">${report.locality}</span>
          <span class="badge badge-${sev.toLowerCase()}">${sev}</span>
        </div>
        <div class="popup-body">
          <p style="margin-bottom: 6px;"><strong>${report.hazardCategory}</strong></p>
          <p style="color: #627D98; margin-bottom: 8px;">${report.landmark || 'Identified Road Stretch'}</p>
          <div class="popup-meta-row">
            <span class="popup-meta-label">Water Depth:</span>
            <span class="popup-meta-val">${report.waterDepthCm} cm</span>
          </div>
          <div class="popup-meta-row">
            <span class="popup-meta-label">Est. Risk Score:</span>
            <span class="popup-meta-val">${report.riskScore || 'N/A'}/100</span>
          </div>
          <div class="popup-meta-row">
            <span class="popup-meta-label">Verification:</span>
            <span class="popup-meta-val">${report.status}</span>
          </div>
          <div style="margin-top: 10px; text-align: right;">
            <button class="btn btn-sm btn-primary" onclick="selectIncidentDetails(${report.id})">View Hazard Pane</button>
          </div>
        </div>
      </div>
    `;

    marker.bindPopup(popupHtml);
    marker.on('click', () => {
      displayIncidentDetails(report);
    });

    markersLayerGroup.addLayer(marker);
  });
}

function renderHotspotZones(hotspots) {
  if (!zonesLayerGroup) return;
  zonesLayerGroup.clearLayers();

  hotspots.forEach(spot => {
    const lat = parseFloat(spot.latitude);
    const lng = parseFloat(spot.longitude);
    const radius = parseFloat(spot.radiusMeters || 350);
    const risk = spot.riskLevel ? spot.riskLevel.toUpperCase() : 'HIGH';

    const color = risk === 'CRITICAL' ? '#D94D4D' : (risk === 'HIGH' ? '#E67E22' : '#E5A12B');

    const circle = L.circle([lat, lng], {
      color: color,
      fillColor: color,
      fillOpacity: 0.18,
      weight: 2,
      radius: radius
    });

    circle.bindTooltip(`<strong>Hotspot: ${spot.locality}</strong><br/>${spot.incidentCount || 10}+ historical incidents recorded`, {
      direction: 'top'
    });

    zonesLayerGroup.addLayer(circle);
  });
}

function renderIncidentList(reports) {
  const container = document.getElementById('incidentListPane');
  if (!container) return;

  container.innerHTML = '';
  if (!reports || reports.length === 0) {
    container.innerHTML = `<div class="empty-state">No hazard reports match your criteria.</div>`;
    return;
  }

  reports.forEach(r => {
    const div = document.createElement('div');
    div.className = 'card';
    div.style.padding = '12px 14px';
    div.style.marginBottom = '10px';
    div.style.cursor = 'pointer';
    div.style.borderLeft = `4px solid ${getSeverityColor(r.severity)}`;

    div.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
        <strong style="font-size: 13px; color: var(--navy);">${r.locality}</strong>
        <span class="badge badge-${r.severity.toLowerCase()}">${r.severity}</span>
      </div>
      <p style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">${r.hazardCategory} • ${r.waterDepthCm} cm depth</p>
      <div style="font-size: 11px; color: var(--text-muted); display: flex; justify-content: space-between;">
        <span>UID: ${r.reportUid}</span>
        <span>${r.status}</span>
      </div>
    `;

    div.addEventListener('click', () => {
      focusOnLocation(parseFloat(r.latitude), parseFloat(r.longitude));
      displayIncidentDetails(r);
    });

    container.appendChild(div);
  });
}

function displayIncidentDetails(report) {
  const detailBox = document.getElementById('hazardDetailBox');
  if (!detailBox) return;

  detailBox.innerHTML = `
    <div style="background: var(--light-blue-surface); border-radius: var(--radius-sm); padding: 14px; border: 1px solid var(--border-grey); margin-bottom: 12px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <h4 style="font-size: 15px; color: var(--navy);">${report.locality}</h4>
        <span class="badge badge-${report.severity.toLowerCase()}">${report.severity}</span>
      </div>
      <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 8px;"><strong>Category:</strong> ${report.hazardCategory}</p>
      <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 8px;">${report.landmark || 'Roadway stretch'}</p>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px; margin-bottom: 10px;">
        <div><strong>Water Depth:</strong> ${report.waterDepthCm} cm</div>
        <div><strong>Risk Score:</strong> ${report.riskScore || 'N/A'}/100</div>
        <div><strong>Status:</strong> ${report.status}</div>
        <div><strong>Reported:</strong> ${new Date(report.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
      </div>
      <p style="font-size: 12px; color: var(--text-secondary); line-height: 1.4;">${report.description || 'Commuters advised to exercise extreme caution in this sector.'}</p>
      ${report.imageUrl ? `<div style="margin-top: 10px;"><img src="${report.imageUrl}" style="width: 100%; border-radius: 6px; max-height: 160px; object-fit: cover;" alt="Report Photo"></div>` : ''}
    </div>
  `;
}

window.selectIncidentDetails = function(reportId) {
  const report = allReportsCache.find(r => r.id === reportId);
  if (report) {
    displayIncidentDetails(report);
    focusOnLocation(parseFloat(report.latitude), parseFloat(report.longitude));
  }
};

function focusOnLocation(lat, lng) {
  if (mapInstance && !isNaN(lat) && !isNaN(lng)) {
    mapInstance.flyTo([lat, lng], 15, { duration: 1.2 });
  }
}

function handleMapClick(lat, lng) {
  if (selectedPinMarker) {
    mapInstance.removeLayer(selectedPinMarker);
  }

  selectedPinMarker = L.marker([lat, lng], {
    icon: L.divIcon({
      className: 'custom-pin pin-high',
      html: '📍',
      iconSize: [26, 26]
    })
  }).addTo(mapInstance);

  const coordsDisplay = document.getElementById('selectedCoordinates');
  if (coordsDisplay) {
    coordsDisplay.textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
}

function setupMapControls() {
  // Locality Search Input
  const searchInput = document.getElementById('mapSearchInput');
  if (searchInput) {
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const query = searchInput.value.trim().toLowerCase();
        const found = allReportsCache.find(r => r.locality.toLowerCase().includes(query));
        if (found) {
          focusOnLocation(parseFloat(found.latitude), parseFloat(found.longitude));
          displayIncidentDetails(found);
          showToast(`Focused on ${found.locality}`, 'info');
        } else {
          showToast(`No recorded incidents found for "${searchInput.value}"`, 'warning');
        }
      }
    });
  }

  // Severity Filter Buttons
  const filterButtons = document.querySelectorAll('.filter-chip');
  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      filterButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filterSev = btn.getAttribute('data-severity');
      if (!filterSev || filterSev === 'ALL') {
        renderMarkers(allReportsCache);
        renderIncidentList(allReportsCache);
      } else {
        const filtered = allReportsCache.filter(r => r.severity.toUpperCase() === filterSev.toUpperCase());
        renderMarkers(filtered);
        renderIncidentList(filtered);
      }
    });
  });

  // Geolocation Button
  const geoBtn = document.getElementById('btnLocateMe');
  if (geoBtn) {
    geoBtn.addEventListener('click', () => {
      if (!navigator.geolocation) {
        showToast('Geolocation is not supported by your browser', 'warning');
        return;
      }
      showToast('Locating your GPS coordinates...', 'info');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          mapInstance.flyTo([lat, lng], 15);
          L.circleMarker([lat, lng], { radius: 8, color: '#168AAD', fillColor: '#168AAD', fillOpacity: 0.9 })
            .addTo(mapInstance)
            .bindPopup('<strong>Your Current Commute Location</strong>').openPopup();
          showToast('GPS Location identified', 'success');
        },
        () => {
          showToast('Unable to retrieve location. Defaulting to GHMC Center.', 'warning');
          focusOnLocation(HYDERABAD_CENTER[0], HYDERABAD_CENTER[1]);
        }
      );
    });
  }
}

function getSeverityColor(sev) {
  switch ((sev || '').toUpperCase()) {
    case 'CRITICAL': return '#D94D4D';
    case 'HIGH': return '#E67E22';
    case 'MODERATE': return '#E5A12B';
    default: return '#2DAD79';
  }
}
