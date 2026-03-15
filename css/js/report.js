(() => {
  const STORAGE_KEY = 'cers_reports';
  let selectedLocation = null;
  let reportMap = null;

  // Initialize map
  function initMap() {
    reportMap = L.map('reportMap').setView([28.7041, 77.1025], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(reportMap);

    // Click to select location
    reportMap.on('click', (e) => {
      selectedLocation = { lat: e.latlng.lat, lng: e.latlng.lng };
      document.getElementById('locationDisplay').value = 
        `${selectedLocation.lat.toFixed(6)}, ${selectedLocation.lng.toFixed(6)}`;
      
      // Remove old marker
      if (window.reportMarker) reportMap.removeLayer(window.reportMarker);
      window.reportMarker = L.circleMarker([selectedLocation.lat, selectedLocation.lng], {
        radius: 8,
        fillColor: '#dc3545',
        color: '#fff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8
      }).addTo(reportMap).bindPopup('📍 Your Location').openPopup();
    });
  }

  // Show health care section for medical emergencies
  document.querySelectorAll('input[name="emergencyType"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const healthcareSection = document.getElementById('healthcareSection');
      if (radio.value === 'medical') {
        healthcareSection.style.display = 'block';
        document.getElementById('serviceAmbulance').checked = true;
      } else {
        healthcareSection.style.display = 'none';
      }
    });
  });

  // Form submission
  document.getElementById('reportForm').addEventListener('submit', (e) => {
    e.preventDefault();

    if (!selectedLocation) {
      alert('❌ Please select a location on the map!');
      return;
    }

    const emergencyType = document.querySelector('input[name="emergencyType"]:checked').value;
    const urgency = document.getElementById('urgency').value;
    const details = document.getElementById('details').value;
    const contact = document.getElementById('contact').value;
    const healthService = document.querySelector('input[name="healthService"]:checked')?.value || null;

    const report = {
      id: 'REP_' + Date.now(),
      ...selectedLocation,
      type: emergencyType,
      urgency: urgency,
      details: details,
      contact: contact,
      healthService: healthService,
      timestamp: new Date().toISOString(),
      status: 'reported'
    };

    // Save to localStorage
    const reports = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    reports.push(report);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));

    // Show success message
    document.getElementById('reportForm').style.display = 'none';
    document.getElementById('successMessage').style.display = 'block';
    document.getElementById('reportId').textContent = `Report ID: ${report.id}`;

    console.log('Report submitted:', report);
  });

  // Initialize on page load
  window.addEventListener('load', initMap);
})();
