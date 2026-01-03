class AnalyticsApp {
  constructor() {
    this.services = [];
    this.appointments = [];
    this.clients = [];
    this.filters = {
      dateType: 'thisMonth',
      specificMonth: '',
      startDate: '',
      endDate: '',
      service: '',
      client: '',
      status: ''
    };
    // ADDED: Bulk selection tracking
    this.selectedAppointments = new Set();
    this.db = firebase.firestore();
    this.init();
  }
  
  async init() {
    await this.loadServices();
    await this.loadAppointments();
    this.setupEventListeners();
    this.setDefaultDates();
    this.toggleDateOptions();
    this.applyFilters();
  }
  
  setDefaultDates() {
    const now = new Date();
    
    const currentMonth = now.toISOString().substring(0, 7);
    document.getElementById('filterSpecificMonth').value = currentMonth;
    this.filters.specificMonth = currentMonth;
    
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    document.getElementById('filterStartDate').value = firstDay.toISOString().split('T')[0];
    document.getElementById('filterEndDate').value = lastDay.toISOString().split('T')[0];
    
    this.filters.startDate = firstDay.toISOString().split('T')[0];
    this.filters.endDate = lastDay.toISOString().split('T')[0];
  }
  
  toggleDateOptions() {
    const dateType = document.getElementById('filterDateType').value;
    const specificMonthGroup = document.getElementById('specificMonthGroup');
    const dateRangeGroup = document.getElementById('dateRangeGroup');
    const dateRangeGroupEnd = document.getElementById('dateRangeGroupEnd');
    
    specificMonthGroup.style.display = 'none';
    dateRangeGroup.style.display = 'none';
    dateRangeGroupEnd.style.display = 'none';
    
    if (dateType === 'specificMonth') {
      specificMonthGroup.style.display = 'flex';
    } else if (dateType === 'dateRange') {
      dateRangeGroup.style.display = 'flex';
      dateRangeGroupEnd.style.display = 'flex';
    }
  }
  
  // Status tab filtering
  filterByStatus(status) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    document.getElementById('filterStatus').value = status;
    this.applyFilters();
  }
  
  // Quick filter handler
  handleQuickFilter(value) {
    if (value) {
      if (['today', 'yesterday', 'last7days', 'last30days'].includes(value)) {
        this.quickFilter(value);
      } else if (value === 'thisMonth') {
        document.getElementById('filterDateType').value = 'thisMonth';
        this.toggleDateOptions();
        this.applyFilters();
      } else if (value === 'lastMonth') {
        document.getElementById('filterDateType').value = 'lastMonth';
        this.toggleDateOptions();
        this.applyFilters();
      }
      document.getElementById('quickFilterDropdown').value = '';
    }
  }
  
  quickFilter(type) {
    const now = new Date();
    let startDate, endDate;
    
    switch (type) {
      case 'today':
        startDate = now.toISOString().split('T')[0];
        endDate = startDate;
        break;
      case 'yesterday':
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        startDate = yesterday.toISOString().split('T')[0];
        endDate = startDate;
        break;
      case 'last7days':
        const last7days = new Date(now);
        last7days.setDate(now.getDate() - 6);
        startDate = last7days.toISOString().split('T')[0];
        endDate = now.toISOString().split('T')[0];
        break;
      case 'last30days':
        const last30days = new Date(now);
        last30days.setDate(now.getDate() - 29);
        startDate = last30days.toISOString().split('T')[0];
        endDate = now.toISOString().split('T')[0];
        break;
    }
    
    document.getElementById('filterDateType').value = 'dateRange';
    document.getElementById('filterStartDate').value = startDate;
    document.getElementById('filterEndDate').value = endDate;
    this.toggleDateOptions();
    this.applyFilters();
  }
  
  // BULK ACTIONS SYSTEM - ADDED
  toggleSelectAll(checked) {
    const checkboxes = document.querySelectorAll('.appointment-checkbox');
    checkboxes.forEach(checkbox => {
      checkbox.checked = checked;
      this.toggleAppointmentSelection(checkbox.dataset.id, checked);
    });
    this.updateSelectionCount();
  }
  
  toggleAppointmentSelection(appointmentId, selected) {
    if (selected) {
      this.selectedAppointments.add(appointmentId);
    } else {
      this.selectedAppointments.delete(appointmentId);
    }
    this.updateSelectionCount();
  }
  
  updateSelectionCount() {
    const countElement = document.getElementById('selectedCount');
    if (countElement) {
      countElement.textContent = `${this.selectedAppointments.size} selected`;
    }
  }
  
  async applyBulkAction() {
    const actionSelect = document.getElementById('bulkAction');
    if (!actionSelect) return;
    
    const action = actionSelect.value;
    if (!action || this.selectedAppointments.size === 0) return;
    
    if (confirm(`Apply "${action}" to ${this.selectedAppointments.size} appointments?`)) {
      const promises = Array.from(this.selectedAppointments).map(id => {
        if (action === 'delete') {
          return this.db.collection('appointments').doc(id).delete();
        } else {
          return this.db.collection('appointments').doc(id).update({
            status: action,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        }
      });
      
      try {
        await Promise.all(promises);
        this.selectedAppointments.clear();
        this.showMessage(`Bulk action completed successfully!`, 'success');
        actionSelect.value = '';
        this.updateSelectionCount();
      } catch (error) {
        console.error('Error in bulk action:', error);
        this.showMessage('Failed to complete bulk action.', 'error');
      }
    }
  }
  
  // Appointment management methods
  showAppointmentActions(appointmentId, appointment) {
    const status = appointment.status || 'scheduled';
    const actions = {
      scheduled: [
        { label: '✅ Mark Completed', action: 'completed', class: 'btn-success' },
        { label: '📅 Reschedule', action: 'reschedule', class: 'btn-warning' },
        { label: '❌ Cancel', action: 'cancelled', class: 'btn-danger' }
      ],
      completed: [
        { label: '↩️ Re-open as Scheduled', action: 'scheduled', class: 'btn-warning' }
      ],
      cancelled: [
        { label: '📅 Re-schedule', action: 'reschedule', class: 'btn-warning' },
        { label: '✅ Mark as Scheduled', action: 'scheduled', class: 'btn-success' }
      ]
    };
    
    let actionHTML = '<div class="appointment-actions">';
    
    if (actions[status]) {
      actions[status].forEach(item => {
        if (item.action === 'reschedule') {
          actionHTML += `<button class="btn-small ${item.class}" onclick="analyticsApp.showRescheduleModal('${appointmentId}')">${item.label}</button>`;
        } else {
          actionHTML += `<button class="btn-small ${item.class}" onclick="analyticsApp.updateAppointmentStatus('${appointmentId}', '${item.action}')">${item.label}</button>`;
        }
      });
    }
    
    actionHTML += `<button class="btn-small btn-danger" onclick="analyticsApp.deleteAppointment('${appointmentId}')">🗑️ Delete</button>`;
    actionHTML += `</div>`;
    
    return actionHTML;
  }
  
  showRescheduleModal(appointmentId) {
    const appointment = this.appointments.find(apt => apt.id === appointmentId);
    if (!appointment) return;
    
    const modalHTML = `
            <div class="modal" id="rescheduleModal" style="display: flex;">
                <div class="modal-content">
                    <h3>📅 Reschedule Appointment</h3>
                    <p><strong>Client:</strong> ${appointment.clientName}</p>
                    <p><strong>Service:</strong> ${appointment.serviceName}</p>
                    <p><strong>Original Date:</strong> ${appointment.date} at ${appointment.time}</p>
                    
                    <div class="form-group">
                        <label>New Date</label>
                        <input type="date" id="newAppointmentDate" value="${appointment.date}" required>
                    </div>
                    <div class="form-group">
                        <label>New Time</label>
                        <input type="time" id="newAppointmentTime" value="${appointment.time}" required>
                    </div>
                    <div class="form-group">
                        <label>Reschedule Reason (Optional)</label>
                        <textarea id="rescheduleNotes" placeholder="Why are you rescheduling?"></textarea>
                    </div>
                    
                    <div class="modal-actions">
                        <button type="button" class="btn-cancel" onclick="analyticsApp.hideRescheduleModal()">Cancel</button>
                        <button type="button" class="btn-save" onclick="analyticsApp.confirmReschedule('${appointmentId}')">Confirm Reschedule</button>
                    </div>
                </div>
            </div>
        `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }
  
  hideRescheduleModal() {
    const modal = document.getElementById('rescheduleModal');
    if (modal) modal.remove();
  }
  
  async confirmReschedule(appointmentId) {
    const newDate = document.getElementById('newAppointmentDate').value;
    const newTime = document.getElementById('newAppointmentTime').value;
    const notes = document.getElementById('rescheduleNotes').value;
    
    if (!newDate || !newTime) {
      alert('Please select both date and time');
      return;
    }
    
    try {
      const updateData = {
        date: newDate,
        time: newTime,
        status: 'scheduled',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      
      if (notes) {
        updateData.rescheduleNotes = notes;
      }
      
      await this.db.collection('appointments').doc(appointmentId).update(updateData);
      this.hideRescheduleModal();
      this.showMessage('Appointment rescheduled successfully!', 'success');
      
    } catch (error) {
      console.error('Error rescheduling appointment:', error);
      this.showMessage('Failed to reschedule appointment.', 'error');
    }
  }
  
  async deleteAppointment(appointmentId) {
    if (confirm('Are you sure you want to permanently delete this appointment? This action cannot be undone.')) {
      try {
        await this.db.collection('appointments').doc(appointmentId).delete();
        this.showMessage('Appointment deleted successfully!', 'success');
      } catch (error) {
        console.error('Error deleting appointment:', error);
        this.showMessage('Failed to delete appointment.', 'error');
      }
    }
  }
  
  async updateAppointmentStatus(appointmentId, newStatus) {
    let note = '';
    
    if (newStatus === 'completed') {
      note = prompt('Add completion notes (optional):', '');
    } else if (newStatus === 'cancelled') {
      note = prompt('Reason for cancellation (optional):', '');
    }
    
    try {
      const updateData = {
        status: newStatus,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      
      if (note) {
        if (newStatus === 'completed') {
          updateData.completionNotes = note;
        } else if (newStatus === 'cancelled') {
          updateData.cancellationReason = note;
        }
      }
      
      await this.db.collection('appointments').doc(appointmentId).update(updateData);
      this.showMessage(`Appointment ${newStatus} successfully!`, 'success');
      
    } catch (error) {
      console.error('Error updating appointment:', error);
      this.showMessage('Failed to update appointment.', 'error');
    }
  }
  
  renderAppointmentNotes(appointment) {
    let notesHTML = '';
    
    if (appointment.notes) {
      notesHTML += `<div class="appointment-notes general-notes">📝 ${appointment.notes}</div>`;
    }
    if (appointment.completionNotes) {
      notesHTML += `<div class="appointment-notes completion-notes">✅ ${appointment.completionNotes}</div>`;
    }
    if (appointment.cancellationReason) {
      notesHTML += `<div class="appointment-notes cancellation-notes">❌ ${appointment.cancellationReason}</div>`;
    }
    if (appointment.rescheduleNotes) {
      notesHTML += `<div class="appointment-notes reschedule-notes">📅 ${appointment.rescheduleNotes}</div>`;
    }
    
    return notesHTML;
  }
  
  async loadServices() {
    try {
      const snapshot = await this.db.collection('services').get();
      this.services = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      this.populateServiceFilter();
    } catch (error) {
      console.error('Error loading services:', error);
    }
  }
  
  async loadAppointments() {
    try {
      const snapshot = await this.db.collection('appointments').get();
      this.appointments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      this.extractClients();
    } catch (error) {
      console.error('Error loading appointments:', error);
    }
  }
  
  extractClients() {
    const clientMap = new Map();
    this.appointments.forEach(apt => {
      if (!clientMap.has(apt.clientPhone)) {
        clientMap.set(apt.clientPhone, {
          name: apt.clientName,
          phone: apt.clientPhone,
          appointmentCount: 0,
          totalSpent: 0
        });
      }
      const client = clientMap.get(apt.clientPhone);
      client.appointmentCount++;
      
      const service = this.services.find(s => s.name === apt.serviceName);
      if (service) {
        client.totalSpent += service.price;
      }
    });
    this.clients = Array.from(clientMap.values());
    this.populateClientFilter();
  }
  
  populateServiceFilter() {
    const dropdown = document.getElementById('filterService');
    if (!dropdown) return;
    
    dropdown.innerHTML = '<option value="">All Services</option>';
    this.services.forEach(service => {
      dropdown.innerHTML += `<option value="${service.name}">${service.name}</option>`;
    });
  }
  
  populateClientFilter() {
    const dropdown = document.getElementById('filterClient');
    if (!dropdown) return;
    
    dropdown.innerHTML = '<option value="">All Clients</option>';
    this.clients.forEach(client => {
      dropdown.innerHTML += `<option value="${client.phone}">${client.name} (${client.phone})</option>`;
    });
  }
  
  setupEventListeners() {
    const elements = [
      'filterDateType', 'filterSpecificMonth', 'filterStartDate',
      'filterEndDate', 'filterService', 'filterClient', 'filterStatus'
    ];
    
    elements.forEach(elementId => {
      const element = document.getElementById(elementId);
      if (element) {
        element.addEventListener('change', () => {
          this.applyFilters();
        });
      }
    });
  }
  
  applyFilters() {
    const getValue = (id) => {
      const element = document.getElementById(id);
      return element ? element.value : '';
    };
    
    this.filters.dateType = getValue('filterDateType');
    this.filters.specificMonth = getValue('filterSpecificMonth');
    this.filters.startDate = getValue('filterStartDate');
    this.filters.endDate = getValue('filterEndDate');
    this.filters.service = getValue('filterService');
    this.filters.client = getValue('filterClient');
    this.filters.status = getValue('filterStatus');
    
    const filteredData = this.filterAppointments();
    this.updateSummary(filteredData);
    this.updateServicesBreakdown(filteredData);
    this.updateDetailedAppointments(filteredData);
    this.updateClientInsights(filteredData);
  }
  
  filterAppointments() {
    return this.appointments.filter(apt => {
      if (!this.filterByDate(apt.date)) {
        return false;
      }
      
      if (this.filters.service && apt.serviceName !== this.filters.service) {
        return false;
      }
      
      if (this.filters.client && apt.clientPhone !== this.filters.client) {
        return false;
      }
      
      if (this.filters.status && apt.status !== this.filters.status) {
        return false;
      }
      
      return true;
    });
  }
  
  filterByDate(aptDate) {
    const date = new Date(aptDate);
    
    switch (this.filters.dateType) {
      case 'thisMonth':
        const now = new Date();
        return date.getMonth() === now.getMonth() &&
          date.getFullYear() === now.getFullYear();
      case 'lastMonth':
        const lastMonth = new Date();
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        return date.getMonth() === lastMonth.getMonth() &&
          date.getFullYear() === lastMonth.getFullYear();
      case 'thisYear':
        const currentYear = new Date().getFullYear();
        return date.getFullYear() === currentYear;
      case 'lastYear':
        const lastYear = new Date().getFullYear() - 1;
        return date.getFullYear() === lastYear;
      case 'specificMonth':
        if (!this.filters.specificMonth) return true;
        const filterMonth = new Date(this.filters.specificMonth + '-01');
        return date.getMonth() === filterMonth.getMonth() &&
          date.getFullYear() === filterMonth.getFullYear();
      case 'dateRange':
        if (!this.filters.startDate || !this.filters.endDate) return true;
        return aptDate >= this.filters.startDate && aptDate <= this.filters.endDate;
      case 'allTime':
        return true;
      default:
        return true;
    }
  }
  updateSummary(filteredAppointments) {
    const totalAppointments = filteredAppointments.length;
    const completedAppointments = filteredAppointments.filter(apt => apt.status === 'completed').length;
    const uniqueClients = new Set(filteredAppointments.map(apt => apt.clientPhone)).size;
    
    let totalRevenue = 0;
    filteredAppointments.forEach(apt => {
      if (apt.status === 'completed') {
        const service = this.services.find(s => s.name === apt.serviceName);
        if (service) {
          totalRevenue += service.price;
        }
      }
    });
    
    const completionRate = totalAppointments > 0 ? Math.round((completedAppointments / totalAppointments) * 100) : 0;
    
    const updateElement = (id, value) => {
      const element = document.getElementById(id);
      if (element) element.textContent = value;
    };
    
    updateElement('totalAppointments', totalAppointments);
    updateElement('totalRevenue', `KSh ${totalRevenue.toLocaleString()}`);
    updateElement('uniqueClients', uniqueClients);
    updateElement('completionRate', `${completionRate}%`);
  }
  
  updateServicesBreakdown(filteredAppointments) {
    const container = document.getElementById('servicesBreakdown');
    if (!container) return;
    
    const serviceStats = {};
    
    this.services.forEach(service => {
      serviceStats[service.name] = {
        name: service.name,
        count: 0,
        revenue: 0,
        price: service.price
      };
    });
    
    filteredAppointments.forEach(apt => {
      if (serviceStats[apt.serviceName]) {
        serviceStats[apt.serviceName].count++;
        if (apt.status === 'completed') {
          serviceStats[apt.serviceName].revenue += serviceStats[apt.serviceName].price;
        }
      }
    });
    
    const servicesArray = Object.values(serviceStats).filter(s => s.count > 0);
    servicesArray.sort((a, b) => b.revenue - a.revenue);
    
    if (servicesArray.length === 0) {
      container.innerHTML = '<div class="loading">No services found for selected filters</div>';
      return;
    }
    
    const maxCount = Math.max(...servicesArray.map(s => s.count));
    
    container.innerHTML = servicesArray.map(service => `
            <div class="service-breakdown-item">
                <div class="service-breakdown-header">
                    <h4>${service.name}</h4>
                    <span class="service-count">${service.count} appointments</span>
                </div>
                <div class="service-breakdown-details">
                    <div class="revenue">Revenue: KSh ${service.revenue.toLocaleString()}</div>
                    <div class="price">Price: KSh ${service.price.toLocaleString()} per session</div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${maxCount > 0 ? (service.count / maxCount * 100) : 0}%"></div>
                    </div>
                </div>
            </div>
        `).join('');
  }
  // Comprehensive Excel Reports
  showReportMenu() {
    // [PASTE THE showReportMenu METHOD CODE HERE]
  }
  
  hideReportModal() {
    // [PASTE THE hideReportModal METHOD CODE HERE]
  }
  
  // Comprehensive Appointments Report
  generateAppointmentsReport() {
    // [PASTE THE generateAppointmentsReport METHOD CODE HERE]
  }
  
  // Revenue Report
  generateRevenueReport() {
    // [PASTE THE generateRevenueReport METHOD CODE HERE]
  }
  
  // Client Report
  generateClientReport() {
    // [PASTE THE generateClientReport METHOD CODE HERE]
  }
  
  // Service Performance Report
  generateServicePerformanceReport() {
    // [PASTE THE generateServicePerformanceReport METHOD CODE HERE]
  }
  
  // Helper method to get most booked service for a client
  getMostBookedService(clientPhone, appointments) {
    // [PASTE THE getMostBookedService METHOD CODE HERE]
  }
  
  // Download CSV utility
  downloadCSV(csv, filename) {
    // [PASTE THE downloadCSV METHOD CODE HERE]
  }
  updateDetailedAppointments(filteredAppointments) {
    const container = document.getElementById('detailedAppointments');
    if (!container) return;
    
    if (filteredAppointments.length === 0) {
      container.innerHTML = '<div class="loading">No appointments found for selected filters</div>';
      return;
    }
    
    const sortedAppointments = filteredAppointments.sort((a, b) => {
      const dateA = new Date(a.date + ' ' + a.time);
      const dateB = new Date(b.date + ' ' + b.time);
      return dateB - dateA;
    });
    
    container.innerHTML = sortedAppointments.map(apt => {
      const service = this.services.find(s => s.name === apt.serviceName);
      const servicePrice = service ? service.price : 0;
      const status = apt.status || 'scheduled';
      
      return `
                <div class="detailed-appointment-item status-${status}">
                    <div class="appointment-main-info">
                        <!-- ADDED: Checkbox for bulk selection -->
                        <input type="checkbox" class="appointment-checkbox" 
                               data-id="${apt.id}" 
                               onchange="analyticsApp.toggleAppointmentSelection('${apt.id}', this.checked)">
                        
                        <div class="appointment-header">
                            <div class="appointment-client">
                                <strong>${apt.clientName}</strong>
                                <span class="client-phone">${apt.clientPhone}</span>
                            </div>
                            <div class="appointment-service">
                                ${apt.serviceName} - KSh ${servicePrice.toLocaleString()}
                            </div>
                        </div>
                        <div class="appointment-datetime">
                            <strong>📅 ${this.formatDate(apt.date)}</strong>
                            <span class="appointment-time">⏰ ${apt.time}</span>
                        </div>
                        ${this.renderAppointmentNotes(apt)}
                    </div>
                    <div class="appointment-meta">
                        <span class="status-badge status-${status}">${status.toUpperCase()}</span>
                        ${this.showAppointmentActions(apt.id, apt)}
                    </div>
                </div>
            `;
    }).join('');
    
    this.updateSelectionCount();
  }
  
  updateClientInsights(filteredAppointments) {
    const container = document.getElementById('clientInsights');
    if (!container) return;
    
    const clientMap = new Map();
    
    filteredAppointments.forEach(apt => {
      if (!clientMap.has(apt.clientPhone)) {
        clientMap.set(apt.clientPhone, {
          name: apt.clientName,
          phone: apt.clientPhone,
          appointments: [],
          totalSpent: 0,
          firstAppointment: apt.date,
          lastAppointment: apt.date
        });
      }
      
      const client = clientMap.get(apt.clientPhone);
      client.appointments.push(apt);
      
      const service = this.services.find(s => s.name === apt.serviceName);
      if (service && apt.status === 'completed') {
        client.totalSpent += service.price;
      }
      
      if (apt.date < client.firstAppointment) client.firstAppointment = apt.date;
      if (apt.date > client.lastAppointment) client.lastAppointment = apt.date;
    });
    
    const clientsArray = Array.from(clientMap.values())
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 10);
    
    if (clientsArray.length === 0) {
      container.innerHTML = '<div class="loading">No client data for selected filters</div>';
      return;
    }
    
    container.innerHTML = clientsArray.map(client => `
            <div class="client-insight-item">
                <div class="client-header">
                    <h4>${client.name}</h4>
                    <span class="client-ltv">KSh ${client.totalSpent.toLocaleString()} total</span>
                </div>
                <div class="client-details">
                    <div>Phone: ${client.phone}</div>
                    <div>Appointments: ${client.appointments.length}</div>
                    <div>First: ${this.formatDate(client.firstAppointment)}</div>
                    <div>Last: ${this.formatDate(client.lastAppointment)}</div>
                </div>
            </div>
        `).join('');
  }
  
  clearFilters() {
    const setValue = (id, value) => {
      const element = document.getElementById(id);
      if (element) element.value = value;
    };
    
    setValue('filterDateType', 'thisMonth');
    setValue('filterService', '');
    setValue('filterClient', '');
    setValue('filterStatus', '');
    
    this.setDefaultDates();
    this.toggleDateOptions();
    this.applyFilters();
  }
  
  exportToCSV() {
    const filteredAppointments = this.filterAppointments();
    
    if (filteredAppointments.length === 0) {
      alert('No data to export!');
      return;
    }
    
    let csv = 'Client Name,Client Phone,Service,Date,Time,Status,Notes\n';
    
    filteredAppointments.forEach(apt => {
      const service = this.services.find(s => s.name === apt.serviceName);
      const price = service ? service.price : 0;
      
      const escapeCsv = (str) => `"${(str || '').replace(/"/g, '""')}"`;
      
      csv += `${escapeCsv(apt.clientName)},${escapeCsv(apt.clientPhone)},${escapeCsv(apt.serviceName + ' (KSh ' + price + ')')},${escapeCsv(apt.date)},${escapeCsv(apt.time)},${escapeCsv(apt.status)},${escapeCsv(apt.notes || '')}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kiki-appointments-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }
  
  formatDate(dateString) {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      return dateString;
    }
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

// Initialize analytics app
let analyticsApp;
document.addEventListener('DOMContentLoaded', () => {
  analyticsApp = new AnalyticsApp();
});