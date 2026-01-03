// client-manager.js
class ClientManager {
  constructor() {
    this.currentView = 'grid';
    this.clients = [];
    this.appointments = [];
    this.modal = null;
  }
  
  async init() {
    await this.loadClientsFromAppointments();
    this.createModal();
    this.renderClients();
  }
  // Add this method to your ClientManager class
  handleSearch(event) {
    const searchTerm = event.target.value.toLowerCase().trim();
    console.log('🔍 Searching for:', searchTerm);
    
    if (searchTerm === '') {
      this.renderClients();
      return;
    }
    
    const filteredClients = this.clients.filter(client =>
      (client.name && client.name.toLowerCase().includes(searchTerm)) ||
      (client.phone && client.phone.includes(searchTerm)) ||
      (client.email && client.email.toLowerCase().includes(searchTerm))
    );
    
    console.log('📋 Filtered clients:', filteredClients);
    this.renderFilteredClients(filteredClients);
  }
  
  // Add this helper method too
  renderFilteredClients(filteredClients) {
    const container = document.getElementById('clientsContainer');
    
    if (filteredClients.length === 0) {
      container.innerHTML = '<div class="no-clients">No clients match your search</div>';
      return;
    }
    
    // Temporarily render filtered clients
    const originalClients = this.clients;
    this.clients = filteredClients;
    this.renderClients();
    this.clients = originalClients;
  }
  
  // Add clear search method
  clearSearch() {
    document.getElementById('clientSearch').value = '';
    this.renderClients();
  }
  async loadClientsFromAppointments() {
    try {
      console.log('🔍 Loading clients from appointments...');
      const snapshot = await firebase.firestore().collection('appointments').get();
      
      this.appointments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      console.log('📊 Appointments loaded:', this.appointments);
      
      // Extract unique clients from appointments
      const clientMap = new Map();
      
      this.appointments.forEach(apt => {
        const phone = apt.clientPhone;
        if (phone && !clientMap.has(phone)) {
          clientMap.set(phone, {
            id: phone, // Use phone as ID since we don't have separate client IDs
            name: apt.clientName || 'Unknown Client',
            phone: apt.clientPhone,
            // Note: No email field in your appointments data
            appointments: [apt] // Start with this appointment
          });
        } else if (phone && clientMap.has(phone)) {
          // Add this appointment to existing client
          clientMap.get(phone).appointments.push(apt);
        }
      });
      
      this.clients = Array.from(clientMap.values());
      
      console.log('✅ Clients extracted:', this.clients);
      
    } catch (error) {
      console.error('❌ Error loading clients:', error);
    }
  }
  
  getClientStats(client) {
    const clientAppointments = client.appointments || [];
    const completedAppointments = clientAppointments.filter(apt => apt.status === 'completed');
    const totalSpent = completedAppointments.reduce((sum, apt) => sum + (parseInt(apt.price) || 0), 0);
    const favoriteService = this.getFavoriteService(clientAppointments);
    
    return {
      totalAppointments: clientAppointments.length,
      completedAppointments: completedAppointments.length,
      totalSpent: totalSpent,
      favoriteService: favoriteService,
      lastVisit: this.getLastVisit(clientAppointments)
    };
  }
  
  getFavoriteService(appointments) {
    if (!appointments || appointments.length === 0) return 'None';
    
    const serviceCount = {};
    appointments.forEach(apt => {
      if (apt.serviceName) {
        serviceCount[apt.serviceName] = (serviceCount[apt.serviceName] || 0) + 1;
      }
    });
    
    if (Object.keys(serviceCount).length === 0) return 'None';
    
    const favorite = Object.keys(serviceCount).reduce((a, b) =>
      serviceCount[a] > serviceCount[b] ? a : b
    );
    return favorite;
  }
  
  getLastVisit(appointments) {
    if (!appointments || appointments.length === 0) return 'Never';
    
    const completed = appointments.filter(apt => apt.status === 'completed');
    if (completed.length === 0) return 'No completed visits';
    
    const lastDate = completed.sort((a, b) => new Date(b.date) - new Date(a.date))[0].date;
    return new Date(lastDate).toLocaleDateString();
  }
  
  switchView(viewType) {
    this.currentView = viewType;
    
    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === viewType);
    });
    
    this.renderClients();
  }
  
  createModal() {
    const modalHTML = `
            <div class="client-modal" id="clientModal">
                <div class="client-modal-content">
                    <div class="client-modal-header">
                        <h3>Client Details</h3>
                        <button class="modal-close" onclick="clientManager.closeModal()">✕ Close</button>
                    </div>
                    <div class="client-modal-body" id="clientModalBody">
                        <!-- Client details will be loaded here -->
                    </div>
                </div>
            </div>
        `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    this.modal = document.getElementById('clientModal');
  }
  
  openModal(clientId) {
    this.renderClientDetails(clientId);
    if (this.modal) {
      this.modal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  }
  
  closeModal() {
    if (this.modal) {
      this.modal.classList.remove('active');
      document.body.style.overflow = '';
    }
  }
  
  renderClients() {
    const container = document.getElementById('clientsContainer');
    
    console.log('🎨 Rendering clients:', this.clients);
    
    if (this.clients.length === 0) {
      container.innerHTML = '<div class="no-clients">No clients found in appointments</div>';
      return;
    }
    
    container.className = 'clients-' + this.currentView + '-view';
    
    switch (this.currentView) {
      case 'grid':
        container.innerHTML = this.renderGridView();
        break;
      case 'list':
        container.innerHTML = this.renderListView();
        break;
      case 'table':
        container.innerHTML = this.renderTableView();
        break;
    }
  }
  
  renderGridView() {
    return this.clients.map(client => {
      const stats = this.getClientStats(client);
      
      return `
            <div class="client-card">
                <div class="client-header">
                    <div class="client-name">${client.name}</div>
                    <div class="client-actions">
                        <button class="btn-sm btn-view-client" onclick="clientManager.openModal('${client.id}')">View</button>
                        <button class="btn-sm btn-sms" onclick="clientManager.sendSMS('${client.id}')">SMS</button>
                    </div>
                </div>
                
                <div class="client-contact">
                    📞 ${client.phone || 'No phone'}<br>
                    ${client.email ? `📧 ${client.email}` : ''}
                </div>
                
                <div class="client-stats">
                    <div class="stat-item">
                        <div class="stat-value">${stats.totalAppointments}</div>
                        <div class="stat-label">Total Appointments</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${stats.completedAppointments}</div>
                        <div class="stat-label">Completed</div>
                    </div>
                </div>
                
                ${stats.favoriteService !== 'None' ? `
                    <div class="client-preferences">
                        <strong>Favorite Service:</strong> 
                        <span class="preference-tag">${stats.favoriteService}</span>
                    </div>
                ` : ''}
                
                <div class="client-meta">
                    <small>Last visit: ${stats.lastVisit}</small>
                </div>
            </div>
        `;
    }).join('');
  }
  
  renderListView() {
    return this.clients.map(client => {
      const stats = this.getClientStats(client);
      
      return `
                <div class="client-list-item">
                    <div class="client-list-info">
                        <strong>${client.name}</strong>
                        <span>📞 ${client.phone || 'No phone'}</span>
                        <div class="client-list-stats">
                            <span>Appointments: ${stats.totalAppointments}</span>
                            <span>Completed: ${stats.completedAppointments}</span>
                            <span>Last: ${stats.lastVisit}</span>
                        </div>
                    </div>
                    <div class="client-actions">
                        <button class="btn-sm btn-view-client" onclick="clientManager.openModal('${client.id}')">View</button>
                        <button class="btn-sm btn-sms" onclick="clientManager.sendSMS('${client.id}')">SMS</button>
                    </div>
                </div>
            `;
    }).join('');
  }
  
  renderTableView() {
    return `
            <table class="clients-table-view">
                <thead>
                    <tr>
                        <th>Client Name</th>
                        <th>Phone</th>
                        <th>Total Appointments</th>
                        <th>Completed</th>
                        <th>Last Visit</th>
                        <th>Favorite Service</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.clients.map(client => {
                        const stats = this.getClientStats(client);
                        
                        return `
                            <tr>
                                <td><strong>${client.name}</strong></td>
                                <td>${client.phone || 'N/A'}</td>
                                <td>${stats.totalAppointments}</td>
                                <td>${stats.completedAppointments}</td>
                                <td>${stats.lastVisit}</td>
                                <td>${stats.favoriteService}</td>
                                <td class="client-actions">
                                    <button class="btn-sm btn-view-client" onclick="clientManager.openModal('${client.id}')">View</button>
                                    <button class="btn-sm btn-sms" onclick="clientManager.sendSMS('${client.id}')">SMS</button>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
  }
  
  renderClientDetails(clientId) {
    const client = this.clients.find(c => c.id === clientId);
    if (!client) return;
    
    const stats = this.getClientStats(client);
    const clientAppointments = client.appointments.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    const modalBody = document.getElementById('clientModalBody');
    modalBody.innerHTML = `
            <div class="client-details-section">
                <h4>👤 Client Information</h4>
                <div><strong>Name:</strong> ${client.name}</div>
                <div><strong>Phone:</strong> ${client.phone || 'N/A'}</div>
                <div><strong>Total Appointments:</strong> ${stats.totalAppointments}</div>
            </div>

            <div class="client-details-section">
                <h4>📊 Client Statistics</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div style="text-align: center; padding: 15px; background: #e3f2fd; border-radius: 8px;">
                        <div style="font-size: 24px; font-weight: bold; color: #007bff;">${stats.totalAppointments}</div>
                        <div style="font-size: 12px; color: #666;">Total Appointments</div>
                    </div>
                    <div style="text-align: center; padding: 15px; background: #e8f5e8; border-radius: 8px;">
                        <div style="font-size: 24px; font-weight: bold; color: #28a745;">${stats.completedAppointments}</div>
                        <div style="font-size: 12px; color: #666;">Completed</div>
                    </div>
                    <div style="text-align: center; padding: 15px; background: #fff3cd; border-radius: 8px;">
                        <div style="font-size: 20px; font-weight: bold; color: #ffc107;">${stats.favoriteService}</div>
                        <div style="font-size: 12px; color: #666;">Favorite Service</div>
                    </div>
                    <div style="text-align: center; padding: 15px; background: #fce4ec; border-radius: 8px;">
                        <div style="font-size: 20px; font-weight: bold; color: #e91e63;">${stats.lastVisit}</div>
                        <div style="font-size: 12px; color: #666;">Last Visit</div>
                    </div>
                </div>
            </div>

            <div class="client-details-section">
                <h4>📅 Recent Appointments</h4>
                ${clientAppointments.slice(0, 5).map(apt => `
                    <div class="appointment-item">
                        <div>
                            <div class="appointment-date">${apt.date} ${apt.time || ''}</div>
                            <div class="appointment-service">${apt.serviceName || 'N/A'} • ${apt.status || 'N/A'}</div>
                            ${apt.notes ? `<div class="appointment-notes"><small>Notes: ${apt.notes}</small></div>` : ''}
                        </div>
                        <div class="appointment-status ${apt.status}">${apt.status || 'Unknown'}</div>
                    </div>
                `).join('')}
                ${clientAppointments.length === 0 ? '<div style="text-align: center; color: #666; padding: 20px;">No appointments</div>' : ''}
            </div>

            <div class="client-details-section">
                <h4>⚡ Quick Actions</h4>
                <div class="quick-actions">
                    <button class="quick-action-btn btn-primary" onclick="clientManager.bookAppointment('${client.id}')">
                        📅 Book New Appointment
                    </button>
                    <button class="quick-action-btn btn-success" onclick="clientManager.sendSMS('${client.id}')">
                        💬 Send SMS
                    </button>
                </div>
            </div>
        `;
  }
  
  sendSMS(clientId) {
    const client = this.clients.find(c => c.id === clientId);
    if (client && client.phone) {
      const message = prompt(`Send SMS to ${client.name} (${client.phone}):`, `Hi ${client.name}! This is revan Mobile Wellness. How can we help you today?`);
      if (message) {
        alert(`SMS would be sent to ${client.phone}: ${message}`);
        // Integrate with SMS API here
      }
    } else {
      alert('Client phone number not available');
    }
  }
  
  bookAppointment(clientId) {
    const client = this.clients.find(c => c.id === clientId);
    alert(`Redirect to booking page for: ${client.name} (${client.phone})`);
    // You can integrate this with your existing booking system
  }
}

// Initialize the client manager
const clientManager = new ClientManager();

// Load when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  clientManager.init();
});