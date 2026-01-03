class KikisApp {
  constructor() {
    this.services = [];
    this.db = firebase.firestore();
    this.init();
  }
  
  async init() {
    await this.loadServices();
    this.setupEventListeners();
  }
  
  async loadServices() {
    try {
      // Listen for real-time updates
      this.db.collection('services').onSnapshot((snapshot) => {
        this.services = [];
        snapshot.forEach((doc) => {
          this.services.push({
            id: doc.id,
            ...doc.data()
          });
        });
        this.displayServices();
        this.updateDropdown();
      });
      
    } catch (error) {
      console.error('Error loading services:', error);
      this.showError('Failed to load services.');
    }
  }
  
  displayServices() {
    const container = document.getElementById('servicesList');
    
    if (this.services.length === 0) {
      container.innerHTML = '<div class="loading">No services found. Add your first service!</div>';
      return;
    }
    
    container.innerHTML = this.services.map(service => `
            <div class="service-item">
                <h4>${service.name}</h4>
                <div class="service-price">KSh ${service.price}</div>
                <div class="service-meta">
                    ${service.description} • ${service.duration} mins • ${service.category}
                </div>
                <div class="service-actions">
                    <button class="btn-edit" onclick="app.editService('${service.id}')">Edit</button>
                    <button class="btn-delete" onclick="app.deleteService('${service.id}')">Delete</button>
                </div>
            </div>
        `).join('');
  }
  
  updateDropdown() {
    const dropdown = document.getElementById('servicesDropdown');
    dropdown.innerHTML = '<option value="">Select a service for booking...</option>';
    
    this.services.forEach(service => {
      if (service.active !== false) {
        dropdown.innerHTML += `
                    <option value="${service.id}">
                        ${service.name} - KSh ${service.price} (${service.duration} mins)
                    </option>
                `;
      }
    });
  }
  
  setupEventListeners() {
    document.getElementById('serviceForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.addService();
    });
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
      
      // Clear form
      document.getElementById('serviceForm').reset();
      
      // Show success message
      this.showMessage('Service added successfully!', 'success');
      
    } catch (error) {
      console.error('Error adding service:', error);
      this.showMessage('Failed to add service.', 'error');
    }
  }
  
  async editService(serviceId) {
    const service = this.services.find(s => s.id === serviceId);
    if (service) {
      // Fill form with service data
      document.getElementById('serviceName').value = service.name;
      document.getElementById('serviceDesc').value = service.description;
      document.getElementById('serviceDuration').value = service.duration;
      document.getElementById('servicePrice').value = service.price;
      document.getElementById('serviceCategory').value = service.category;
      
      // Change button text
      const submitBtn = document.querySelector('#serviceForm button');
      submitBtn.textContent = 'Update Service';
      
      // Remove current submit listener
      document.getElementById('serviceForm').removeEventListener('submit', this.addService);
      
      // Add update listener
      document.getElementById('serviceForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.updateService(serviceId);
      });
    }
  }
  
  async updateService(serviceId) {
    const formData = {
      name: document.getElementById('serviceName').value,
      description: document.getElementById('serviceDesc').value,
      duration: parseInt(document.getElementById('serviceDuration').value),
      price: parseInt(document.getElementById('servicePrice').value),
      category: document.getElementById('serviceCategory').value,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    try {
      await this.db.collection('services').doc(serviceId).update(formData);
      
      // Reset form and button
      document.getElementById('serviceForm').reset();
      document.querySelector('#serviceForm button').textContent = 'Add Service';
      
      // Reset event listener
      this.setupEventListeners();
      
      this.showMessage('Service updated successfully!', 'success');
      
    } catch (error) {
      console.error('Error updating service:', error);
      this.showMessage('Failed to update service.', 'error');
    }
  }
  
  async deleteService(serviceId) {
    if (confirm('Are you sure you want to delete this service?')) {
      try {
        await this.db.collection('services').doc(serviceId).delete();
        this.showMessage('Service deleted successfully!', 'success');
      } catch (error) {
        console.error('Error deleting service:', error);
        this.showMessage('Failed to delete service.', 'error');
      }
    }
  }
  
  showMessage(message, type) {
    // Create toast message
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
    
    // Remove after 3 seconds
    setTimeout(() => {
      toast.remove();
    }, 3000);
  }
  
  showError(message) {
    const container = document.getElementById('servicesList');
    container.innerHTML = `<div class="error">${message}</div>`;
  }
}

// Initialize the app when the page loads
let app;
document.addEventListener('DOMContentLoaded', () => {
  app = new KikisApp();
});
class KikisApp {
  constructor() {
    this.services = [];
    this.events = [];
    this.currentView = 'month';
    this.currentDate = new Date();
    this.db = firebase.firestore();
    this.init();
  }
  
  // Add these new methods to your existing class
  setCalendarView(view) {
    this.currentView = view;
    
    // Update active button
    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    this.renderCalendar();
  }
  
  showAddEventModal() {
    const modal = document.getElementById('addEventModal');
    modal.style.display = 'flex';
  }
  
  hideAddEventModal() {
    const modal = document.getElementById('addEventModal');
    modal.style.display = 'none';
    document.getElementById('eventForm').reset();
  }
  
  async addEvent(eventData) {
    try {
      await this.db.collection('appointments').add({
        ...eventData,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      this.hideAddEventModal();
      this.showMessage('Appointment added successfully!', 'success');
      
    } catch (error) {
      console.error('Error adding appointment:', error);
      this.showMessage('Failed to add appointment.', 'error');
    }
  }
  
  renderCalendar() {
    const container = document.getElementById('calendarView');
    
    switch (this.currentView) {
      case 'month':
        container.innerHTML = this.renderMonthView();
        break;
      case 'week':
        container.innerHTML = this.renderWeekView();
        break;
      case 'day':
        container.innerHTML = this.renderDayView();
        break;
      case 'list':
        container.innerHTML = this.renderListView();
        break;
    }
  }
  
  renderMonthView() {
    const firstDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), 1);
    const lastDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 0);
    const startingDay = firstDay.getDay();
    
    let html = `
            <div class="month-view">
                <div class="month-header">
                    <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
                </div>
                <div class="month-days">
        `;
    
    // Empty cells for days before month starts
    for (let i = 0; i < startingDay; i++) {
      html += `<div class="day-cell empty"></div>`;
    }
    
    // Days of the month
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const dateStr = `${this.currentDate.getFullYear()}-${this.currentDate.getMonth() + 1}-${day}`;
      const dayEvents = this.events.filter(event =>
        event.date === dateStr
      );
      
      const isToday = new Date().toDateString() === new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), day).toDateString();
      
      html += `
                <div class="day-cell ${isToday ? 'today' : ''}">
                    <div class="day-number">${day}</div>
                    ${dayEvents.map(event => `
                        <div class="calendar-event" onclick="app.viewEvent('${event.id}')">
                            ${event.time} - ${event.clientName}
                        </div>
                    `).join('')}
                </div>
            `;
    }
    
    html += `</div></div>`;
    return html;
  }
  
  renderListView() {
    const sortedEvents = this.events.sort((a, b) => a.date.localeCompare(b.date));
    
    if (sortedEvents.length === 0) {
      return '<div class="loading">No appointments scheduled</div>';
    }
    
    return `
            <div class="list-view">
                ${sortedEvents.map(event => `
                    <div class="event-item">
                        <div class="event-details">
                            <h4>${event.serviceName}</h4>
                            <div class="event-time">${event.date} at ${event.time}</div>
                            <div>Client: ${event.clientName} (${event.clientPhone})</div>
                        </div>
                        <div class="event-actions">
                            <button class="btn-edit" onclick="app.editEvent('${event.id}')">Edit</button>
                            <button class="btn-delete" onclick="app.deleteEvent('${event.id}')">Delete</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
  }
  
  // Add event form handler
  setupEventListeners() {
    document.getElementById('serviceForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.addService();
    });
    
    document.getElementById('eventForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.addEventFromForm();
    });
  }
  
  async addEventFromForm() {
    const formData = {
      clientName: document.getElementById('clientName').value,
      clientPhone: document.getElementById('clientPhone').value,
      serviceName: document.getElementById('eventService').value,
      date: document.getElementById('eventDate').value,
      time: document.getElementById('eventTime').value,
      notes: document.getElementById('eventNotes').value,
      status: 'scheduled'
    };
    
    await this.addEvent(formData);
  }
}