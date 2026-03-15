(() => {
  const STORAGE_KEY = 'cers_reports';
  const ASSIGN_KEY = 'cers_assignments';
  let controlMap = null;
  let markers = {};
  let charts = {};

  // Department data
  const departments = [
    { id: 1, name: 'Central Police Station', type: 'police', lat: 28.7041, lng: 77.1025, available: true },
    { id: 2, name: 'North Fire Station', type: 'fire', lat: 28.7180, lng: 77.1200, available: true },
    { id: 3, name: 'Blinkit Ambulance Hub', type: 'ambulance', lat: 28.6900, lng: 77.0850, available: true },
    { id: 4, name: 'East Police Outpost', type: 'police', lat: 28.7055, lng: 77.1300, available: true },
    { id: 5, name: 'South Fire Station', type: 'fire', lat: 28.6800, lng: 77.1100, available: true },
    { id: 6, name: 'City Hospital', type: 'hospital', lat: 28.6955, lng: 77.0950, available: true }
  ];

  // Icons
  const icons = {
    police: L.divIcon({ className: 'dept-marker', html: '<i class="fas fa-shield-halved" style="font-size:20px;color:#0dcaf0;"></i>', iconSize: [30, 30] }),
    fire: L.divIcon({ className: 'dept-marker', html: '<i class="fas fa-fire" style="font-size:20px;color:#ffc107;"></i>', iconSize: [30, 30] }),
    ambulance: L.divIcon({ className: 'dept-marker', html: '<i class="fas fa-ambulance" style="font-size:20px;color:#dc3545;"></i>', iconSize: [30, 30] }),
    hospital: L.divIcon({ className: 'dept-marker', html: '<i class="fas fa-hospital" style="font-size:20px;color:#198754;"></i>', iconSize: [30, 30] }),
    report: L.divIcon({ className: 'report-marker', html: '<i class="fas fa-exclamation-circle" style="font-size:20px;color:#ff6b6b;"></i>', iconSize: [30, 30] })
  };

  // Initialize map
  function initMap() {
    controlMap = L.map('controlMap').setView([28.7041, 77.1025], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(controlMap);

    // Add department markers
    departments.forEach(dept => {
      const marker = L.marker([dept.lat, dept.lng], { icon: icons[dept.type] })
        .bindPopup(`<strong>${dept.name}</strong><br><small>${dept.type.toUpperCase()}</small>`)
        .addTo(controlMap);
      markers[dept.id] = marker;
    });

    refreshUI();
  }

  // Distance calculation
  function distanceKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // Find nearest department
  function findNearest(report, type) {
    let nearest = null;
    departments.forEach(dept => {
      const matchType = (type === 'medical' && dept.type === 'ambulance') ||
                       (type === 'fire' && dept.type === 'fire') ||
                       (type === 'crime' && dept.type === 'police') ||
                       (type === 'accident' && dept.type === 'police');
      if (matchType && dept.available) {
        const dist = distanceKm(report.lat, report.lng, dept.lat, dept.lng);
        if (!nearest || dist < nearest.dist) {
          nearest = { dept, dist };
        }
      }
    });
    return nearest;
  }

  // Refresh UI
  function refreshUI() {
    const reports = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const assignments = JSON.parse(localStorage.getItem(ASSIGN_KEY) || '[]');

    // Update stats
    const active = reports.filter(r => r.status === 'reported').length;
    const resolved = reports.filter(r => r.status === 'resolved').length;
    document.getElementById('activeReports').textContent = active;
    document.getElementById('resolvedReports').textContent = resolved;
    document.getElementById('deployedUnits').textContent = assignments.length;

    // Update incidents list
    const incidentsList = document.getElementById('incidentsList');
    incidentsList.innerHTML = '';
    
    reports.slice().reverse().forEach(report => {
      const time = new Date(report.timestamp).toLocaleTimeString();
      const urgencyIcon = report.urgency === 'critical' ? '🔴' : report.urgency === 'high' ? '🟠' : '🟡';
      const typeIcon = report.type === 'medical' ? '🏥' : report.type === 'fire' ? '🔥' : report.type === 'accident' ? '🚗' : '🚨';

      const item = document.createElement('div');
      item.className = 'incident-item';
      item.innerHTML = `
        <div class="incident-type">${typeIcon} ${report.type.toUpperCase()} ${urgencyIcon}</div>
        <div class="incident-location">📍 ${report.lat.toFixed(4)}, ${report.lng.toFixed(4)}</div>
        <div class="incident-time">${time}</div>
        <div style="margin-top:10px;">
          <button class="btn btn-sm btn-success allocateBtn" data-id="${report.id}">
            <i class="fas fa-ambulance"></i> Allocate Unit
          </button>
          <button class="btn btn-sm btn-outline-secondary resolveBtn" data-id="${report.id}">
            <i class="fas fa-check"></i> Resolve
          </button>
        </div>
      `;

      item.querySelector('.allocateBtn').addEventListener('click', () => allocateUnit(report));
      item.querySelector('.resolveBtn').addEventListener('click', () => resolveIncident(report.id));

      incidentsList.appendChild(item);

      // Add marker to map
      const marker = L.circleMarker([report.lat, report.lng], {
        radius: 8,
        fillColor: '#ff6b6b',
        color: '#fff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8
      }).addTo(controlMap).bindPopup(`<strong>${report.type.toUpperCase()}</strong><br>${report.details}`);
    });

    // Update department status
    updateDepartmentStatus();

    // Update charts
    updateCharts(reports);
  }

  // Allocate unit
  function allocateUnit(report) {
    const nearest = findNearest(report, report.type);
    if (!nearest) {
      alert('❌ No available units of this type!');
      return;
    }

    const assignment = {
      id: 'ASSIGN_' + Date.now(),
      reportId: report.id,
      deptId: nearest.dept.id,
      timestamp: new Date().toISOString(),
      distance: nearest.dist
    };

    const assignments = JSON.parse(localStorage.getItem(ASSIGN_KEY) || '[]');
    assignments.push(assignment);
    localStorage.setItem(ASSIGN_KEY, JSON.stringify(assignments));

    // Draw line on map
    L.polyline([[nearest.dept.lat, nearest.dept.lng], [report.lat, report.lng]], {
      color: '#28a745',
      weight: 3,
      opacity: 0.8,
      dashArray: '5, 5'
    }).addTo(controlMap).bindPopup(`${nearest.dept.name} → Incident (${nearest.dist.toFixed(2)}km)`);

    alert(`✅ Assigned ${nearest.dept.name}\nDistance: ${nearest.dist.toFixed(2)} km`);
    refreshUI();
  }

  // Resolve incident
  function resolveIncident(reportId) {
    const reports = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const report = reports.find(r => r.id === reportId);
    if (report) {
      report.status = 'resolved';
      localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
      refreshUI();
    }
  }

  // Update department status
  function updateDepartmentStatus() {
    const assignments = JSON.parse(localStorage.getItem(ASSIGN_KEY) || '[]');
    const deptStatus = document.getElementById('departmentStatus');
    deptStatus.innerHTML = '';

    departments.forEach(dept => {
      const assigned = assignments.filter(a => a.deptId === dept.id).length;
      const status = assigned > 0 ? 'busy' : 'available';
      const statusText = assigned > 0 ? `Busy (${assigned} unit${assigned > 1 ? 's' : ''})` : 'Available';

      const item = document.createElement('div');
      item.className = 'dept-item';
      item.innerHTML = `
        <div>
          <strong>${dept.name}</strong>
          <div style="font-size:12px;color:#999;">${dept.type.toUpperCase()}</div>
        </div>
        <span class="dept-badge ${status}">${statusText}</span>
      `;
      deptStatus.appendChild(item);
    });
  }

  // Update charts
  function updateCharts(reports) {
    // Incident Distribution
    const typeCounts = { medical: 0, fire: 0, crime: 0, accident: 0 };
    reports.forEach(r => typeCounts[r.type]++);

    if (charts.incident) charts.incident.destroy();
    charts.incident = new Chart(document.getElementById('incidentChart'), {
      type: 'doughnut',
      data: {
        labels: ['Medical', 'Fire', 'Crime', 'Accident'],
        datasets: [{
          data: [typeCounts.medical, typeCounts.fire, typeCounts.crime, typeCounts.accident],
          backgroundColor: ['#dc3545', '#ffc107', '#0dcaf0', '#198754'],
          borderColor: '#1a2633',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { labels: { color: '#fff' } }
        }
      }
    });

    // Response Times
    const urgencyCounts = { critical: 0, high: 0, normal: 0 };
    reports.forEach(r => urgencyCounts[r.urgency]++);

    if (charts.response) charts.response.destroy();
    charts.response = new Chart(document.getElementById('responseChart'), {
      type: 'bar',
      data: {
        labels: ['Critical', 'High', 'Normal'],
        datasets: [{
          label: 'Incident Count',
          data: [urgencyCounts.critical, urgencyCounts.high, urgencyCounts.normal],
          backgroundColor: ['#ff6b6b', '#ffc107', '#0dcaf0'],
          borderColor: '#1a2633',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        indexAxis: 'y',
        plugins: {
          legend: { labels: { color: '#fff' } }
        },
        scales: {
          x: { ticks: { color: '#fff' }, grid: { color: '#2a3f52' } },
          y: { ticks: { color: '#fff' }, grid: { color: '#2a3f52' } }
        }
      }
    });
  }

  // Button events
  document.getElementById('refreshMap').addEventListener('click', refreshUI);
  document.getElementById('clearMap').addEventListener('click', () => {
    if (confirm('Clear all reports?')) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(ASSIGN_KEY);
      refreshUI();
    }
  });

  // Initialize on load
  window.addEventListener('load', initMap);
})();
