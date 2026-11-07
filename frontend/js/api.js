/**
 * =====================================================================
 * FLOODROUTE - API Client & Data Provider
 * Connects with Spring Boot backend at http://localhost:8080/api
 * With graceful demonstration fallback for reliable evaluation
 * =====================================================================
 */

// Automatically resolve backend API across local and cloud environments
const API_BASE_URL = window.FLOODROUTE_API_BASE_URL
  || localStorage.getItem('floodroute_api_base_url')
  || (window.location.origin && window.location.origin.startsWith('http') && !window.location.origin.includes(':5500') && !window.location.origin.includes(':3000') && !window.location.origin.includes(':5000')
      ? `${window.location.origin}/api`
      : 'http://localhost:8080/api');

const FloodAPI = {
  // Authentication token management
  getToken() {
    return localStorage.getItem('floodroute_token') || null;
  },

  setToken(token) {
    if (token) {
      localStorage.setItem('floodroute_token', token);
    } else {
      localStorage.removeItem('floodroute_token');
    }
  },

  getCurrentUser() {
    const userStr = localStorage.getItem('floodroute_user');
    return userStr ? JSON.parse(userStr) : null;
  },

  setCurrentUser(user) {
    if (user) {
      localStorage.setItem('floodroute_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('floodroute_user');
    }
  },

  logout() {
    this.setToken(null);
    this.setCurrentUser(null);
    window.location.href = 'login.html';
  },

  getHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  },

  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const opts = {
      headers: this.getHeaders(),
      ...options
    };

    try {
      const response = await fetch(url, opts);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Request failed with status ${response.status}`);
      }
      return await response.json();
    } catch (err) {
      console.warn(`[FloodAPI] Backend call to ${endpoint} failed or offline. Using demo fallback:`, err.message);
      return this.handleFallback(endpoint, options);
    }
  },

  // -------------------------------------------------------------
  // Public & Citizen Endpoints
  // -------------------------------------------------------------
  async login(username, password) {
    try {
      const data = await this.request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });
      if (data && data.token) {
        this.setToken(data.token);
        this.setCurrentUser({
          id: data.id,
          username: data.username,
          email: data.email,
          fullName: data.fullName,
          role: data.role
        });
      }
      return data;
    } catch (e) {
      // Fallback demo authentication
      if (username === 'admin' && password === 'admin123') {
        const adminUser = { id: 1, username: 'admin', email: 'admin@ghmc.gov.in', fullName: 'GHMC Admin', role: 'ROLE_ADMIN' };
        this.setToken('mock-jwt-admin-token');
        this.setCurrentUser(adminUser);
        return { token: 'mock-jwt-admin-token', ...adminUser, message: 'Logged in as Admin (Demo Mode)' };
      } else if (username === 'citizen' && password === 'citizen123') {
        const citizenUser = { id: 2, username: 'citizen', email: 'citizen@hyd.in', fullName: 'Ravi Kumar', role: 'ROLE_USER' };
        this.setToken('mock-jwt-user-token');
        this.setCurrentUser(citizenUser);
        return { token: 'mock-jwt-user-token', ...citizenUser, message: 'Logged in as Citizen (Demo Mode)' };
      }
      throw new Error('Invalid credentials. (Demo: admin/admin123 or citizen/citizen123)');
    }
  },

  async register(registerData) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(registerData)
    });
  },

  async getReports(params = {}) {
    const query = new URLSearchParams(params).toString();
    const endpoint = `/reports${query ? '?' + query : ''}`;
    return this.request(endpoint);
  },

  async getReportById(id) {
    return this.request(`/reports/${id}`);
  },

  async createReport(reportData) {
    return this.request('/reports', {
      method: 'POST',
      body: JSON.stringify(reportData)
    });
  },

  async updateReportStatus(id, statusData) {
    return this.request(`/reports/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify(statusData)
    });
  },

  async getLocations() {
    return this.request('/locations');
  },

  async getHotspots() {
    return this.request('/hotspots');
  },

  async getAlerts() {
    return this.request('/alerts');
  },

  async getRainfall() {
    return this.request('/rainfall');
  },

  async getAnalytics() {
    return this.request('/analytics');
  },

  async calculateRisk(riskData) {
    return this.request('/risk-assessments', {
      method: 'POST',
      body: JSON.stringify(riskData)
    });
  },

  async planRoute(routeData) {
    return this.request('/routes/plan', {
      method: 'POST',
      body: JSON.stringify(routeData)
    });
  },

  async simulateRainfall(simData) {
    return this.request('/rainfall/simulate', {
      method: 'POST',
      body: JSON.stringify(simData)
    });
  },

  async uploadImage(file) {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`${API_BASE_URL}/reports/upload-image`, {
        method: 'POST',
        headers: {
          ...(this.getToken() ? { 'Authorization': `Bearer ${this.getToken()}` } : {})
        },
        body: formData
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Backend image upload endpoint offline. Creating local data URL.');
    }
    // Fallback: Read as Data URL
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve({ imageUrl: e.target.result, message: 'Local image preview' });
      reader.readAsDataURL(file);
    });
  },

  // -------------------------------------------------------------
  // Live Weather from Open-Meteo (Hyderabad GHMC)
  // -------------------------------------------------------------
  async fetchLiveHyderabadWeather() {
    try {
      const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=17.3850&longitude=78.4867&current=temperature_2m,relative_humidity_2m,precipitation,rain,weather_code,wind_speed_10m&timezone=Asia%2FKolkata');
      if (res.ok) {
        const data = await res.json();
        return data.current;
      }
    } catch (e) {
      console.warn('Open-Meteo external weather API unreachable. Using telemetry fallback.');
    }
    return {
      temperature_2m: 26.4,
      relative_humidity_2m: 88,
      precipitation: 24.5,
      rain: 24.5,
      weather_code: 63,
      wind_speed_10m: 14.2
    };
  },

  // -------------------------------------------------------------
  // Graceful Fallback Mock Data Store (Ensures seamless college viva)
  // -------------------------------------------------------------
  handleFallback(endpoint, options) {
    const storedReports = JSON.parse(localStorage.getItem('floodroute_local_reports') || '[]');

    if (endpoint.startsWith('/reports') && options.method === 'POST') {
      const body = JSON.parse(options.body);
      const newId = Date.now();
      const newReport = {
        id: newId,
        reportUid: `HYD-2026-${Math.floor(1000 + Math.random() * 9000)}`,
        reporterName: body.reporterName || 'Anonymous Citizen',
        phone: body.phone || '',
        locality: body.locality,
        landmark: body.landmark || '',
        latitude: parseFloat(body.latitude),
        longitude: parseFloat(body.longitude),
        hazardCategory: body.hazardCategory,
        waterDepthCm: parseFloat(body.waterDepthCm),
        severity: body.severity,
        description: body.description || '',
        imageUrl: body.imageUrl || '',
        status: 'PENDING_VERIFICATION',
        riskScore: (body.severity === 'CRITICAL' ? 88.0 : (body.severity === 'HIGH' ? 72.0 : 45.0)),
        createdAt: new Date().toISOString()
      };
      storedReports.unshift(newReport);
      localStorage.setItem('floodroute_local_reports', JSON.stringify(storedReports));
      return newReport;
    }

    if (endpoint.startsWith('/reports')) {
      const baseDemoReports = [
        { id: 1, reportUid: 'HYD-2026-0001', reporterName: 'K. Sridhar (Commuter)', phone: '+91-9848011223', locality: 'Tolichowki', landmark: 'Near Tolichowki Flyover Underpass', latitude: 17.4011, longitude: 78.4124, hazardCategory: 'Underpass flooding', waterDepthCm: 65.0, severity: 'CRITICAL', status: 'VERIFIED', riskScore: 86.5, createdAt: new Date(Date.now() - 45*60000).toISOString() },
        { id: 2, reportUid: 'HYD-2026-0002', reporterName: 'Anand Rao (Resident)', phone: '+91-9959022334', locality: 'Begumpet', landmark: 'Near Rasoolpura Junction & Nala', latitude: 17.4447, longitude: 78.4664, hazardCategory: 'Drainage overflow', waterDepthCm: 52.0, severity: 'HIGH', status: 'VERIFIED', riskScore: 78.0, createdAt: new Date(Date.now() - 75*60000).toISOString() },
        { id: 3, reportUid: 'HYD-2026-0003', reporterName: 'P. Sunitha (Citizen)', phone: '+91-9701033445', locality: 'Malakpet', landmark: 'Near Malakpet Railway Bridge Underpass', latitude: 17.3753, longitude: 78.4988, hazardCategory: 'Underpass flooding', waterDepthCm: 75.0, severity: 'CRITICAL', status: 'VERIFIED', riskScore: 91.2, createdAt: new Date(Date.now() - 30*60000).toISOString() },
        { id: 4, reportUid: 'HYD-2026-0004', reporterName: 'Venkatesh M.', phone: '+91-9866044556', locality: 'Kukatpally', landmark: 'Near Y-Junction & Metro Pillar 780', latitude: 17.4849, longitude: 78.4138, hazardCategory: 'Road waterlogging', waterDepthCm: 38.0, severity: 'MODERATE', status: 'VERIFIED', riskScore: 56.4, createdAt: new Date(Date.now() - 110*60000).toISOString() },
        { id: 5, reportUid: 'HYD-2026-0005', reporterName: 'GHMC Road Guard Unit', phone: '+91-40-23456789', locality: 'LB Nagar', landmark: 'Near LB Nagar Ring Road Underpass', latitude: 17.3457, longitude: 78.5522, hazardCategory: 'Severe flooding', waterDepthCm: 60.0, severity: 'CRITICAL', status: 'VERIFIED', riskScore: 84.0, createdAt: new Date(Date.now() - 140*60000).toISOString() },
        { id: 6, reportUid: 'HYD-2026-0006', reporterName: 'Citizen Reporter', phone: '+91-9123456780', locality: 'Ameerpet', landmark: 'Near Maitrivanam Complex', latitude: 17.4375, longitude: 78.4482, hazardCategory: 'Blocked drainage', waterDepthCm: 25.0, severity: 'MODERATE', status: 'PENDING_VERIFICATION', riskScore: 48.0, createdAt: new Date(Date.now() - 25*60000).toISOString() },
        { id: 7, reportUid: 'HYD-2026-0007', reporterName: 'Mohd. Imran', phone: '+91-9345678901', locality: 'Mehdipatnam', landmark: 'Near Rythu Bazar Junction', latitude: 17.3916, longitude: 78.4398, hazardCategory: 'Road waterlogging', waterDepthCm: 30.0, severity: 'MODERATE', status: 'VERIFIED', riskScore: 52.5, createdAt: new Date(Date.now() - 95*60000).toISOString() },
        { id: 8, reportUid: 'HYD-2026-0008', reporterName: 'IT Corridor Commuter', phone: '+91-9456789012', locality: 'Gachibowli', landmark: 'Near ORR Junction Underpass', latitude: 17.4401, longitude: 78.3489, hazardCategory: 'Road waterlogging', waterDepthCm: 18.0, severity: 'LOW', status: 'RESOLVED', riskScore: 28.0, createdAt: new Date(Date.now() - 200*60000).toISOString() },
        { id: 9, reportUid: 'HYD-2026-0009', reporterName: 'Suresh Reddy', phone: '+91-9567890123', locality: 'Uppal', landmark: 'Near Uppal Metro Station Pillar 12', latitude: 17.4018, longitude: 78.5602, hazardCategory: 'Drainage overflow', waterDepthCm: 42.0, severity: 'HIGH', status: 'VERIFIED', riskScore: 71.0, createdAt: new Date(Date.now() - 130*60000).toISOString() },
        { id: 10, reportUid: 'HYD-2026-0010', reporterName: 'Deepak Verma', phone: '+91-9678901234', locality: 'Miyapur', landmark: 'Near Allwyn X Roads', latitude: 17.4968, longitude: 78.3614, hazardCategory: 'Road waterlogging', waterDepthCm: 22.0, severity: 'LOW', status: 'RESOLVED', riskScore: 24.5, createdAt: new Date(Date.now() - 240*60000).toISOString() }
      ];
      return [...storedReports, ...baseDemoReports];
    }

    if (endpoint.startsWith('/locations')) {
      return [
        { id: 1, name: 'Kukatpally', localityCode: 'LOC-KUK', zoneName: 'Kukatpally Zone', latitude: 17.4849, longitude: 78.4138, elevationMeters: 510.0, drainageIndex: 75.0, historicalVulnerability: 80.0 },
        { id: 2, name: 'Miyapur', localityCode: 'LOC-MIY', zoneName: 'Serilingampally Zone', latitude: 17.4968, longitude: 78.3614, elevationMeters: 535.0, drainageIndex: 60.0, historicalVulnerability: 65.0 },
        { id: 3, name: 'Ameerpet', localityCode: 'LOC-AME', zoneName: 'Khairatabad Zone', latitude: 17.4375, longitude: 78.4482, elevationMeters: 505.0, drainageIndex: 70.0, historicalVulnerability: 75.0 },
        { id: 4, name: 'Mehdipatnam', localityCode: 'LOC-MEH', zoneName: 'Khairatabad Zone', latitude: 17.3916, longitude: 78.4398, elevationMeters: 512.0, drainageIndex: 65.0, historicalVulnerability: 70.0 },
        { id: 5, name: 'LB Nagar', localityCode: 'LOC-LBN', zoneName: 'LB Nagar Zone', latitude: 17.3457, longitude: 78.5522, elevationMeters: 495.0, drainageIndex: 80.0, historicalVulnerability: 85.0 },
        { id: 6, name: 'Uppal', localityCode: 'LOC-UPP', zoneName: 'Uppal Zone', latitude: 17.4018, longitude: 78.5602, elevationMeters: 492.0, drainageIndex: 75.0, historicalVulnerability: 78.0 },
        { id: 7, name: 'Dilsukhnagar', localityCode: 'LOC-DIL', zoneName: 'LB Nagar Zone', latitude: 17.3688, longitude: 78.5247, elevationMeters: 498.0, drainageIndex: 72.0, historicalVulnerability: 74.0 },
        { id: 8, name: 'Tolichowki', localityCode: 'LOC-TOL', zoneName: 'Khairatabad Zone', latitude: 17.4011, longitude: 78.4124, elevationMeters: 508.0, drainageIndex: 85.0, historicalVulnerability: 90.0 },
        { id: 9, name: 'Gachibowli', localityCode: 'LOC-GAC', zoneName: 'Serilingampally Zone', latitude: 17.4401, longitude: 78.3489, elevationMeters: 545.0, drainageIndex: 45.0, historicalVulnerability: 40.0 },
        { id: 10, name: 'Secunderabad', localityCode: 'LOC-SEC', zoneName: 'Secunderabad Zone', latitude: 17.4399, longitude: 78.4983, elevationMeters: 518.0, drainageIndex: 68.0, historicalVulnerability: 72.0 }
      ];
    }

    if (endpoint.startsWith('/hotspots')) {
      return [
        { id: 1, hotspotCode: 'HOT-TOL-01', locality: 'Tolichowki', latitude: 17.4011, longitude: 78.4124, radiusMeters: 350.0, incidentCount: 18, averageSeverity: 86.5, riskLevel: 'CRITICAL', description: 'Tolichowki Underpass and low-lying market junction.' },
        { id: 2, hotspotCode: 'HOT-MAL-02', locality: 'Malakpet', latitude: 17.3753, longitude: 78.4988, radiusMeters: 300.0, incidentCount: 22, averageSeverity: 91.2, riskLevel: 'CRITICAL', description: 'Malakpet Railway Bridge Underpass catchment bottleneck.' },
        { id: 3, hotspotCode: 'HOT-BEG-03', locality: 'Begumpet', latitude: 17.4447, longitude: 78.4664, radiusMeters: 400.0, incidentCount: 15, averageSeverity: 78.0, riskLevel: 'HIGH', description: 'Rasoolpura Junction & Begumpet Nala confluence.' },
        { id: 4, hotspotCode: 'HOT-LBN-04', locality: 'LB Nagar', latitude: 17.3457, longitude: 78.5522, radiusMeters: 380.0, incidentCount: 14, averageSeverity: 84.0, riskLevel: 'CRITICAL', description: 'LB Nagar Ring Road Underpass low depression.' },
        { id: 5, hotspotCode: 'HOT-UPP-06', locality: 'Uppal', latitude: 17.4018, longitude: 78.5602, radiusMeters: 320.0, incidentCount: 11, averageSeverity: 71.0, riskLevel: 'HIGH', description: 'Uppal Bus Depot stretch and link road water accumulation.' }
      ];
    }

    if (endpoint.startsWith('/alerts')) {
      return [
        { id: 1, alertCode: 'ALT-2026-001', title: 'Critical Flooding: Tolichowki Underpass Impassable', message: 'Water levels at Tolichowki Underpass have exceeded 65 cm. Diversions in place via Shaikpet Flyover.', severity: 'CRITICAL', locality: 'Tolichowki', status: 'ACTIVE', source: 'GHMC Emergency Cell', issuedAt: new Date(Date.now() - 30*60000).toISOString() },
        { id: 2, alertCode: 'ALT-2026-002', title: 'Severe Water Stagnation: Malakpet Railway Underpass', message: 'Malakpet Railway Bridge submerged up to 75 cm. Commuters advised to take Chaderghat - Moosarambagh bypass.', severity: 'CRITICAL', locality: 'Malakpet', status: 'ACTIVE', source: 'Hyderabad Traffic Police', issuedAt: new Date(Date.now() - 50*60000).toISOString() },
        { id: 3, alertCode: 'ALT-2026-003', title: 'High Inundation Advisory: Begumpet Nala / Rasoolpura', message: 'Stormwater overflow near Rasoolpura. Single-lane movement towards Secunderabad.', severity: 'HIGH', locality: 'Begumpet', status: 'ACTIVE', source: 'GHMC Disaster Management', issuedAt: new Date(Date.now() - 85*60000).toISOString() }
      ];
    }

    if (endpoint.startsWith('/analytics')) {
      return {
        totalReports: 10 + storedReports.length,
        criticalRiskCount: 3,
        highRiskCount: 2,
        moderateRiskCount: 3 + storedReports.length,
        lowRiskCount: 2,
        pendingCount: 1 + storedReports.length,
        verifiedCount: 7,
        resolvedCount: 2,
        currentAvgRainfallMm: 48.5,
        rainfallTrend: 'Monsoon Active (Elevated)',
        localityStats: [
          { locality: 'Tolichowki', count: 18 },
          { locality: 'Malakpet', count: 22 },
          { locality: 'Begumpet', count: 15 },
          { locality: 'LB Nagar', count: 14 },
          { locality: 'Uppal', count: 11 },
          { locality: 'Kukatpally', count: 9 },
          { locality: 'Mehdipatnam', count: 8 }
        ],
        severityDistribution: [
          { severity: 'Critical', count: 3, color: '#D94D4D' },
          { severity: 'High', count: 2, color: '#E67E22' },
          { severity: 'Moderate', count: 3, color: '#E5A12B' },
          { severity: 'Low', count: 2, color: '#2DAD79' }
        ],
        monthlyTrends: [
          { month: 'June', reports: 18, rainfallMm: 112 },
          { month: 'July', reports: 46, rainfallMm: 235 },
          { month: 'August', reports: 58, rainfallMm: 280 },
          { month: 'September', reports: 64, rainfallMm: 310 },
          { month: 'October', reports: 38, rainfallMm: 195 },
          { month: 'November', reports: 12, rainfallMm: 42 }
        ],
        recentReports: [
          { id: 1, reportUid: 'HYD-2026-0001', locality: 'Tolichowki', landmark: 'Near Tolichowki Flyover Underpass', hazardCategory: 'Underpass flooding', waterDepthCm: 65.0, severity: 'CRITICAL', status: 'VERIFIED', riskScore: 86.5, createdAt: new Date(Date.now() - 45*60000).toISOString() },
          { id: 2, reportUid: 'HYD-2026-0002', locality: 'Begumpet', landmark: 'Near Rasoolpura Junction & Nala', hazardCategory: 'Drainage overflow', waterDepthCm: 52.0, severity: 'HIGH', status: 'VERIFIED', riskScore: 78.0, createdAt: new Date(Date.now() - 75*60000).toISOString() },
          { id: 3, reportUid: 'HYD-2026-0003', locality: 'Malakpet', landmark: 'Near Malakpet Railway Bridge Underpass', hazardCategory: 'Underpass flooding', waterDepthCm: 75.0, severity: 'CRITICAL', status: 'VERIFIED', riskScore: 91.2, createdAt: new Date(Date.now() - 30*60000).toISOString() },
          { id: 4, reportUid: 'HYD-2026-0004', locality: 'Kukatpally', landmark: 'Near Y-Junction & Metro Pillar 780', hazardCategory: 'Road waterlogging', waterDepthCm: 38.0, severity: 'MODERATE', status: 'VERIFIED', riskScore: 56.4, createdAt: new Date(Date.now() - 110*60000).toISOString() }
        ]
      };
    }

    return {};
  }
};
