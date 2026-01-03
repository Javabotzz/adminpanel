class ReportsManager {
  constructor(db) {
    this.db = db;
    this.services = [];
    this.appointments = [];
  }
  
  async showReports() {
    try {
      // Load services first
      await this.loadServices();
      
      // Then load appointments
      const snapshot = await this.db.collection('appointments').get();
      this.appointments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      console.log('📊 Loaded appointments:', this.appointments);
      console.log('💎 Loaded services:', this.services);
      
      this.displayReportsTable(this.appointments);
      
    } catch (error) {
      console.error('Error loading reports:', error);
      this.showMessage('Failed to load reports.', 'error');
    }
  }
  
  async loadServices() {
    try {
      const snapshot = await this.db.collection('services').get();
      this.services = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      console.log('✅ Services loaded for reports:', this.services.length);
    } catch (error) {
      console.error('Error loading services for reports:', error);
      this.services = [];
    }
  }
  
  displayReportsTable(appointments) {
    // Remove existing modal if any
    const existingModal = document.getElementById('reportsModal');
    if (existingModal) existingModal.remove();
    
    const modalHTML = `
            <div class="modal" id="reportsModal" style="display: flex;">
                <div class="modal-content" style="max-width: 95%; max-height: 90vh; width: 95%;">
                    <div class="modal-header">
                        <h3>📊 All Bookings Report (${appointments.length} records)</h3>
                        <div>
                            <button class="btn-primary" onclick="adminApp.reportsManager.downloadReportsExcel()">📥 Download Excel</button>
                            <button class="btn-cancel" onclick="adminApp.reportsManager.hideReportsModal()">Close</button>
                        </div>
                    </div>
                    
                    <!-- Filters -->
                    <div class="reports-filters">
                        <input type="text" id="reportSearch" placeholder="🔍 Search clients, services..." 
                               onkeyup="adminApp.reportsManager.filterReportsTable()">
                        <select id="reportStatusFilter" onchange="adminApp.reportsManager.filterReportsTable()">
                            <option value="">All Statuses</option>
                            <option value="scheduled">Scheduled</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                        <select id="reportServiceFilter" onchange="adminApp.reportsManager.filterReportsTable()">
                            <option value="">All Services</option>
                        </select>
                    </div>
                    
                    <!-- Excel-like Table -->
                    <div class="reports-table-container">
                        <table class="reports-table">
                            <thead>
                                <tr>
                                    <th>Booking Date</th>
                                    <th>Scheduled Date</th>
                                    <th>Scheduled Time</th>
                                    <th>Client Name</th>
                                    <th>Phone</th>
                                    <th>Service</th>
                                    <th>Duration</th>
                                    <th>Price</th>
                                    <th>Status</th>
                                    <th>Notes</th>
                                </tr>
                            </thead>
                            <tbody id="reportsTableBody">
                                ${appointments.map(apt => {
                                    const serviceDetails = this.findServiceDetails(apt);
                                    const servicePrice = serviceDetails ? serviceDetails.price : (apt.price || 0);
                                    const serviceDuration = serviceDetails ? serviceDetails.duration : (apt.duration || 'N/A');
                                    const bookingDate = apt.bookingDate || apt.createdAt || this.getCurrentDate();
                                    
                                    return `
                                    <tr>
                                        <td>${this.formatDate(bookingDate)}</td>
                                        <td>${apt.date || 'N/A'}</td>
                                        <td>${apt.time || 'N/A'}</td>
                                        <td>${apt.clientName || 'N/A'}</td>
                                        <td>${apt.clientPhone || 'N/A'}</td>
                                        <td>${apt.serviceName || 'N/A'}</td>
                                        <td>${serviceDuration}${serviceDuration !== 'N/A' ? ' mins' : ''}</td>
                                        <td>KSh ${parseFloat(servicePrice).toLocaleString()}</td>
                                        <td><span class="status-badge status-${apt.status || 'scheduled'}">${apt.status || 'scheduled'}</span></td>
                                        <td>${apt.notes || ''}</td>
                                    </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    this.populateServiceFilter();
  }
  
  // Enhanced service matching
  findServiceDetails(appointment) {
    if (!this.services || this.services.length === 0) {
      console.warn('No services available for matching');
      return null;
    }
    
    // Try multiple matching strategies
    let service = null;
    
    // 1. Match by service ID (most reliable)
    if (appointment.serviceId) {
      service = this.services.find(s => s.id === appointment.serviceId);
      if (service) {
        console.log('✅ Matched service by ID:', service.name);
        return service;
      }
    }
    
    // 2. Match by service name (exact match)
    if (appointment.serviceName) {
      service = this.services.find(s =>
        s.name && appointment.serviceName &&
        s.name.toLowerCase().trim() === appointment.serviceName.toLowerCase().trim()
      );
      if (service) {
        console.log('✅ Matched service by exact name:', service.name);
        return service;
      }
    }
    
    // 3. Match by service name (partial match)
    if (appointment.serviceName) {
      service = this.services.find(s =>
        s.name && appointment.serviceName &&
        s.name.toLowerCase().includes(appointment.serviceName.toLowerCase()) ||
        appointment.serviceName.toLowerCase().includes(s.name.toLowerCase())
      );
      if (service) {
        console.log('✅ Matched service by partial name:', service.name);
        return service;
      }
    }
    
    // 4. Check if service name exists in any service field
    if (appointment.serviceName) {
      service = this.services.find(s =>
        Object.values(s).some(value =>
          typeof value === 'string' &&
          value.toLowerCase().includes(appointment.serviceName.toLowerCase())
        )
      );
      if (service) {
        console.log('✅ Matched service by field content:', service.name);
        return service;
      }
    }
    
    console.warn('❌ No service match found for appointment:', {
      appointmentService: appointment.serviceName,
      appointmentId: appointment.serviceId,
      availableServices: this.services.map(s => s.name)
    });
    return null;
  }
  
  formatDate(dateValue) {
    try {
      if (!dateValue) return 'N/A';
      
      // Handle Firestore timestamps
      if (dateValue.toDate && typeof dateValue.toDate === 'function') {
        const date = dateValue.toDate();
        return isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString();
      }
      
      // Handle string dates
      if (typeof dateValue === 'string') {
        const date = new Date(dateValue);
        return isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString();
      }
      
      // Handle other cases
      const date = new Date(dateValue);
      return isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString();
      
    } catch (error) {
      console.warn('Date formatting error:', error, dateValue);
      return 'N/A';
    }
  }
  
  getCurrentDate() {
    return new Date().toISOString().split('T')[0];
  }
  
  filterReportsTable() {
    const search = document.getElementById('reportSearch').value.toLowerCase();
    const statusFilter = document.getElementById('reportStatusFilter').value;
    const serviceFilter = document.getElementById('reportServiceFilter').value;
    
    const rows = document.querySelectorAll('#reportsTableBody tr');
    
    rows.forEach(row => {
      const clientName = row.cells[3]?.textContent?.toLowerCase() || '';
      const phone = row.cells[4]?.textContent?.toLowerCase() || '';
      const service = row.cells[5]?.textContent?.toLowerCase() || '';
      const status = row.cells[8]?.textContent?.toLowerCase() || '';
      
      const matchesSearch = clientName.includes(search) || phone.includes(search) || service.includes(search);
      const matchesStatus = !statusFilter || status.includes(statusFilter);
      const matchesService = !serviceFilter || service.includes(serviceFilter.toLowerCase());
      
      row.style.display = (matchesSearch && matchesStatus && matchesService) ? '' : 'none';
    });
  }
  
  populateServiceFilter() {
    try {
      const filter = document.getElementById('reportServiceFilter');
      if (!filter) {
        console.error('Service filter element not found');
        return;
      }
      
      // Clear existing options except the first one
      filter.innerHTML = '<option value="">All Services</option>';
      
      if (!this.services || this.services.length === 0) {
        console.warn('No services available for filter');
        return;
      }
      
      // Get unique service names from appointments
      const appointmentServices = [...new Set(this.appointments.map(apt => apt.serviceName).filter(Boolean))];
      
      appointmentServices.forEach(service => {
        const option = document.createElement('option');
        option.value = service;
        option.textContent = service;
        filter.appendChild(option);
      });
      
      console.log('✅ Service filter populated with:', appointmentServices);
      
    } catch (error) {
      console.error('Error populating service filter:', error);
    }
  }
  
  downloadReportsExcel() {
    try {
      let csv = 'Booking Date,Scheduled Date,Scheduled Time,Client Name,Phone,Service,Duration,Price,Status,Notes\n';
      
      const visibleRows = document.querySelectorAll('#reportsTableBody tr[style=""]');
      visibleRows.forEach(row => {
        const cells = row.cells;
        const rowData = [
          cells[0]?.textContent || '',
          cells[1]?.textContent || '',
          cells[2]?.textContent || '',
          cells[3]?.textContent || '',
          cells[4]?.textContent || '',
          cells[5]?.textContent || '',
          cells[6]?.textContent || '',
          cells[7]?.textContent || '',
          cells[8]?.textContent || '',
          cells[9]?.textContent || ''
        ];
        csv += rowData.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',') + '\n';
      });
      
      this.downloadCSV(csv, `all-bookings-${new Date().toISOString().split('T')[0]}.csv`);
      this.showMessage('Report downloaded successfully!', 'success');
      
    } catch (error) {
      console.error('Error downloading Excel:', error);
      this.showMessage('Failed to download report.', 'error');
    }
  }
  
  hideReportsModal() {
    const modal = document.getElementById('reportsModal');
    if (modal) modal.remove();
  }
  
  downloadCSV(csv, filename) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }
  
  showMessage(message, type) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 5px;
            color: white;
            font-weight: bold;
            z-index: 1000;
            background: ${type === 'success' ? '#4CAF50' : '#f44336'};
        `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }
}