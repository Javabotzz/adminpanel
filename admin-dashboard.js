class AdminDashboard {
  constructor() {
    this.services = [];
    this.appointments = [];
    this.db = firebase.firestore();
    
    // ADD THIS LINE: Initialize Reports Manager
    this.reportsManager = new ReportsManager(this.db, this.services);
    
    this.init();
  }
  
  async loadAppointments() {
    try {
      const snapshot = await this.db.collection('appointments').get();
      this.appointments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error loading appointments:', error);
    }
  }
  
  async init() {
    await this.loadServices();
    await this.loadTodaysAppointments();
    this.setupEventListeners();
    this.loadDashboardKPIs();
  }
  
  async loadServices() {
    try {
      // Use get() instead of onSnapshot for initial load
      const snapshot = await this.db.collection('services').get();
      this.services = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      this.displayServices();
      
      // Optional: Keep real-time updates for future changes
      this.db.collection('services').onSnapshot((snapshot) => {
        this.services = [];
        snapshot.forEach((doc) => {
          this.services.push({
            id: doc.id,
            ...doc.data()
          });
        });
        this.displayServices();
      });
      
    } catch (error) {
      console.error('Error loading services:', error);
    }
  }
  
  async loadTodaysAppointments() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const snapshot = await this.db.collection('appointments')
        .where('date', '==', today)
        .get();
      
      this.appointments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      return this.appointments;
    } catch (error) {
      console.error('Error loading appointments:', error);
      return [];
    }
  }
  
  // Global Search Methods
  handleGlobalSearch(event) {
    if (event.key === 'Enter') {
      const query = event.target.value.toLowerCase();
      if (query.length > 2) {
        this.filterServices(query);
      } else if (query.length === 0) {
        this.clearSearch();
      }
    }
  }
  
  // ADD THIS SIMPLE METHOD: Reports button handler
  async showReports() {
    await this.reportsManager.showReports();
  }
  
  // ADD THIS METHOD: Clients button handler  
  async showClients() {
    await this.loadAppointments(); // Make sure we have appointments data
    const clientMap = new Map();
    
    this.appointments.forEach(apt => {
      if (!clientMap.has(apt.clientPhone)) {
        clientMap.set(apt.clientPhone, {
          name: apt.clientName,
          phone: apt.clientPhone,
          totalAppointments: 0,
          completedAppointments: 0,
          totalSpent: 0,
          firstAppointment: apt.date,
          lastAppointment: apt.date,
          allAppointments: []
        });
      }
      
      const client = clientMap.get(apt.clientPhone);
      client.totalAppointments++;
      client.allAppointments.push({
        date: apt.date,
        service: apt.serviceName,
        status: apt.status,
        price: this.getServicePrice(apt.serviceName)
      });
      
      if (apt.status === 'completed') {
        client.completedAppointments++;
        client.totalSpent += this.getServicePrice(apt.serviceName);
      }
      
      if (apt.date < client.firstAppointment) client.firstAppointment = apt.date;
      if (apt.date > client.lastAppointment) client.lastAppointment = apt.date;
    });
    
    const clients = Array.from(clientMap.values());
    this.displayClientsModal(clients);
  }
  
  // Helper method to get service price
  getServicePrice(serviceName) {
    const service = this.services.find(s => s.name === serviceName);
    return service ? service.price : 0;
  }
  // Fix for service addition
  async addService(serviceData) {
    try {
      // Validate service data
      if (!serviceData.name || !serviceData.price || !serviceData.duration) {
        throw new Error('Please fill in all required fields');
      }
      
      // Ensure price is a number
      serviceData.price = parseInt(serviceData.price);
      serviceData.duration = parseInt(serviceData.duration);
      
      if (isNaN(serviceData.price) || isNaN(serviceData.duration)) {
        throw new Error('Price and duration must be numbers');
      }
      
      // Add to Firebase
      const docRef = await firebase.firestore().collection('services').add({
        name: serviceData.name,
        description: serviceData.description || '',
        price: serviceData.price,
        duration: serviceData.duration,
        category: serviceData.category || 'General',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'active'
      });
      
      console.log('Service added successfully:', docRef.id);
      this.showMessage('Service added successfully!', 'success');
      this.loadServices(); // Reload the services list
      
    } catch (error) {
      console.error('Error adding service:', error);
      this.showMessage(`Error adding service: ${error.message}`, 'error');
    }
  }
  // Method to display clients in a modal
  displayClientsModal(clients) {
    const sortedClients = clients.sort((a, b) => b.totalSpent - a.totalSpent);
    
    const modalHTML = `
            <div class="modal" id="clientsModal" style="display: flex;">
                <div class="modal-content" style="max-width: 800px; max-height: 80vh;">
                    <div class="modal-header">
                        <h3>👥 Client Database (${sortedClients.length} clients)</h3>
                        <button class="btn-primary" onclick="adminApp.exportClientsToExcel()">Export to Excel</button>
                    </div>
                    <div class="clients-list" style="max-height: 60vh; overflow-y: auto;">
                        ${sortedClients.map(client => `
                            <div class="client-card">
                                <div class="client-header">
                                    <div class="client-info">
                                        <h4>${client.name}</h4>
                                        <span class="client-phone">${client.phone}</span>
                                    </div>
                                    <div class="client-stats">
                                        <span class="client-ltv">KSh ${client.totalSpent.toLocaleString()}</span>
                                        <span class="client-appointments">${client.totalAppointments} apps</span>
                                    </div>
                                </div>
                                <div class="client-details">
                                    <div class="client-meta">
                                        <span>First: ${this.formatDate(client.firstAppointment)}</span>
                                        <span>Last: ${this.formatDate(client.lastAppointment)}</span>
                                        <span>Completed: ${client.completedAppointments}/${client.totalAppointments}</span>
                                    </div>
                                    <div class="client-services">
                                        <strong>Recent Services:</strong>
                                        ${client.allAppointments.slice(0, 3).map(apt => `
                                            <span class="service-tag">${apt.service} (${apt.status})</span>
                                        `).join('')}
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    <div class="modal-actions">
                        <button class="btn-cancel" onclick="adminApp.hideClientsModal()">Close</button>
                    </div>
                </div>
            </div>
        `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }
  
  hideClientsModal() {
    const modal = document.getElementById('clientsModal');
    if (modal) modal.remove();
  }
  
  // Export clients to Excel
  exportClientsToExcel() {
    const clientCards = document.querySelectorAll('.client-card');
    if (!clientCards.length) {
      alert('No client data to export!');
      return;
    }
    
    let csv = 'Client Name,Phone,Total Appointments,Completed Appointments,Total Spent,First Appointment,Last Appointment\n';
    
    clientCards.forEach(card => {
      const name = card.querySelector('h4').textContent;
      const phone = card.querySelector('.client-phone').textContent;
      const appointments = card.querySelector('.client-appointments').textContent.split(' ')[0];
      const spent = card.querySelector('.client-ltv').textContent.replace('KSh ', '').replace(/,/g, '');
      const metaSpans = card.querySelectorAll('.client-meta span');
      const firstAppointment = metaSpans[0].textContent.replace('First: ', '');
      const lastAppointment = metaSpans[1].textContent.replace('Last: ', '');
      const completed = metaSpans[2].textContent.split('/')[0].replace('Completed: ', '');
      
      csv += `"${name}","${phone}",${appointments},${completed},${spent},"${firstAppointment}","${lastAppointment}"\n`;
    });
    
    this.downloadCSV(csv, 'kiki-clients-database.csv');
  }
  
  // Download CSV utility
  downloadCSV(csv, filename) {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }
  
  filterServices(query) {
    const filtered = this.services.filter(service =>
      service.name.toLowerCase().includes(query) ||
      service.description.toLowerCase().includes(query) ||
      service.category.toLowerCase().includes(query)
    );
    this.displayFilteredServices(filtered);
  }
  
  displayFilteredServices(filteredServices) {
    const container = document.getElementById('servicesList');
    
    if (filteredServices.length === 0) {
      container.innerHTML = '<div class="loading">No services found matching your search.</div>';
      return;
    }
    
    container.innerHTML = filteredServices.map(service => `
            <div class="service-item">
                <h4>${service.name}</h4>
                <div class="service-price">KSh ${service.price}</div>
                <div class="service-meta">
                    ${service.duration} mins • ${service.category}
                </div>
            </div>
        `).join('');
  }
  
  clearSearch() {
    document.getElementById('globalSearch').value = '';
    this.displayServices();
  }
  
  // Dashboard KPIs and Activity Feed
  async loadDashboardKPIs() {
    const today = new Date().toISOString().split('T')[0];
    const appointments = await this.loadTodaysAppointments();
    
    const todaysApps = appointments.filter(apt => apt.date === today);
    const pending = appointments.filter(apt => apt.status === 'scheduled');
    const completed = appointments.filter(apt => apt.status === 'completed');
    
    let revenue = 0;
    completed.forEach(apt => {
      const service = this.services.find(s => s.name === apt.serviceName);
      if (service) revenue += service.price;
    });
    
    this.updateElement('todaysAppointments', todaysApps.length);
    this.updateElement('pendingActions', pending.length);
    this.updateElement('todaysRevenue', `KSh ${revenue.toLocaleString()}`);
    
    const completionRate = appointments.length ?
      Math.round((completed.length / appointments.length) * 100) : 0;
    this.updateElement('completionRate', `${completionRate}%`);
    
    this.updateActivityFeed(appointments);
  }
  
  updateActivityFeed(appointments) {
    const container = document.getElementById('activityFeed');
    if (!container) return;
    
    const recentActivities = appointments
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);
    
    if (recentActivities.length === 0) {
      container.innerHTML = '<div class="empty-state">No recent activity</div>';
      return;
    }
    
    container.innerHTML = recentActivities.map(apt => `
            <div class="activity-item">
                <div class="activity-icon">${this.getActivityIcon(apt.status)}</div>
                <div class="activity-details">
                    <strong>${apt.clientName}</strong> - ${apt.serviceName}
                    <div class="activity-meta">${this.formatTime(apt.createdAt)} • ${apt.status}</div>
                </div>
            </div>
        `).join('');
  }
  
  getActivityIcon(status) {
    const icons = {
      scheduled: '📅',
      completed: '✅',
      cancelled: '❌'
    };
    return icons[status] || '📝';
  }
  
  formatTime(timestamp) {
    if (!timestamp) return 'Just now';
    
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      return 'Recently';
    }
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
  
  updateElement(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  }
  
  displayServices() {
    const container = document.getElementById('servicesList');
    
    if (this.services.length === 0) {
      container.innerHTML = '<div class="loading">No services found. Click "Add Service" to create your first service!</div>';
      return;
    }
    
    const recentServices = this.services.slice(0, 5);
    
    container.innerHTML = recentServices.map(service => `
            <div class="service-item">
                <h4>${service.name}</h4>
                <div class="service-price">KSh ${service.price}</div>
                <div class="service-meta">
                    ${service.duration} mins • ${service.category}
                </div>
            </div>
        `).join('');
  }
  
  setupEventListeners() {
    document.getElementById('serviceForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.addService();
    });
    
    const globalSearch = document.getElementById('globalSearch');
    if (globalSearch) {
      globalSearch.addEventListener('keyup', (e) => {
        this.handleGlobalSearch(e);
      });
    }
  }
  
  async addService() {
    const formData = {
      name: document.getElementById('serviceName').value,
      description: document.getElementById('serviceDesc').value,
      duration: parseInt(document.getElementById('serviceDuration').value),
      price: parseInt(document.getElementById('servicePrice').value),
      category: document.getElementById('serviceCategory').value,
      active: true,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    try {
      await this.db.collection('services').add(formData);
      document.getElementById('serviceForm').reset();
      this.showMessage('Service added successfully!', 'success');
      this.hideServiceForm();
    } catch (error) {
      console.error('Error adding service:', error);
      this.showMessage('Failed to add service.', 'error');
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

// Global functions for button clicks
function showServiceForm() {
  document.getElementById('quickServiceForm').style.display = 'block';
}

function hideServiceForm() {
  document.getElementById('quickServiceForm').style.display = 'none';
}

// REMOVE THESE - they're now handled by the class methods:
// function showClients() { alert('Client management coming soon!'); }
// function showReports() { alert('Reports coming soon!'); }

// Initialize the dashboard
let adminApp;
document.addEventListener('DOMContentLoaded', () => {
  adminApp = new AdminDashboard();
});