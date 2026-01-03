class ScheduleApp {
  constructor() {
    this.services = [];
    this.appointments = [];
    this.currentView = 'month';
    this.currentDate = new Date();
    this.db = firebase.firestore();
    this.init();
  }
  
  async init() {
    console.log("Schedule app initializing...");
    await this.loadServices();
    await this.loadAppointments();
    this.setupEventListeners();
    this.renderCalendar();
  }
  
  async loadServices() {
    try {
      const snapshot = await this.db.collection('services').get();
      this.services = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      this.populateServicesDropdown();
    } catch (error) {
      console.error("Error loading services:", error);
    }
  }
  
  async loadAppointments() {
    try {
      this.db.collection('appointments').onSnapshot((snapshot) => {
        this.appointments = [];
        snapshot.forEach((doc) => {
          this.appointments.push({
            id: doc.id,
            ...doc.data()
          });
        });
        console.log("Appointments loaded:", this.appointments.length);
        this.renderCalendar();
        this.renderTodaysAppointments();
      });
    } catch (error) {
      console.error("Error loading appointments:", error);
    }
  }
  
  populateServicesDropdown() {
    const dropdown = document.getElementById('eventService');
    dropdown.innerHTML = '<option value="">Select Service</option>';
    this.services.forEach(service => {
      dropdown.innerHTML += `<option value="${service.name}">${service.name} - KSh ${service.price}</option>`;
    });
  }
  
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
    console.log("Showing add event modal");
    document.getElementById('addEventModal').style.display = 'flex';
    // Set today's date as default
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('eventDate').value = today;
  }
  
  hideAddEventModal() {
    document.getElementById('addEventModal').style.display = 'none';
    document.getElementById('eventForm').reset();
  }
  
  setupEventListeners() {
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
      status: 'scheduled',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    try {
      await this.db.collection('appointments').add(formData);
      this.hideAddEventModal();
      this.showMessage('Appointment added successfully!', 'success');
    } catch (error) {
      console.error('Error adding appointment:', error);
      this.showMessage('Failed to add appointment.', 'error');
    }
  }
  
  renderCalendar() {
    const container = document.getElementById('calendarView');
    
    if (this.currentView === 'month') {
      container.innerHTML = this.renderMonthView();
    } else if (this.currentView === 'list') {
      container.innerHTML = this.renderListView();
    }
  }
  
  renderMonthView() {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startingDay = firstDay.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
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
      const dateStr = `${year}-${month + 1}-${day}`;
      const dayEvents = this.appointments.filter(event =>
        event.date === dateStr
      );
      
      const isToday = new Date().toDateString() === new Date(year, month, day).toDateString();
      
      html += `
                <div class="day-cell ${isToday ? 'today' : ''}">
                    <div class="day-number">${day}</div>
                    ${dayEvents.map(event => `
                        <div class="calendar-event" onclick="scheduleApp.viewEvent('${event.id}')">
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
    // Sort appointments by date
    const sortedEvents = this.appointments.sort((a, b) => {
      const dateA = new Date(a.date + ' ' + a.time);
      const dateB = new Date(b.date + ' ' + b.time);
      return dateA - dateB;
    });
    
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
                            ${event.notes ? `<div>Notes: ${event.notes}</div>` : ''}
                        </div>
                        <div class="event-actions">
                            <button class="btn-edit" onclick="scheduleApp.editEvent('${event.id}')">Edit</button>
                            <button class="btn-delete" onclick="scheduleApp.deleteEvent('${event.id}')">Delete</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
  }
  
  renderTodaysAppointments() {
    const today = new Date().toISOString().split('T')[0];
    const todaysApps = this.appointments.filter(apt => apt.date === today);
    
    const container = document.getElementById('todaysAppointments');
    
    if (todaysApps.length === 0) {
      container.innerHTML = '<div class="loading">No appointments for today</div>';
      return;
    }
    
    container.innerHTML = todaysApps.map(apt => `
            <div class="appointment-item">
                <div class="appointment-details">
                    <h4>${apt.serviceName}</h4>
                    <div class="appointment-time">${apt.time}</div>
                    <div>${apt.clientName} • ${apt.clientPhone}</div>
                    ${apt.notes ? `<div class="appointment-notes">${apt.notes}</div>` : ''}
                </div>
                <div class="appointment-actions">
                    <button class="btn-edit" onclick="scheduleApp.editEvent('${apt.id}')">Edit</button>
                    <button class="btn-delete" onclick="scheduleApp.deleteEvent('${apt.id}')">Delete</button>
                </div>
            </div>
        `).join('');
  }
  
  viewEvent(eventId) {
    const event = this.appointments.find(apt => apt.id === eventId);
    if (event) {
      alert(`Appointment Details:\nClient: ${event.clientName}\nPhone: ${event.clientPhone}\nService: ${event.serviceName}\nDate: ${event.date}\nTime: ${event.time}\nNotes: ${event.notes || 'None'}`);
    }
  }
  
  editEvent(eventId) {
    const event = this.appointments.find(apt => apt.id === eventId);
    if (event) {
      // For now, just show an alert - you can implement full edit later
      alert(`Edit functionality for appointment with ${event.clientName} will be implemented soon!`);
    }
  }
  
  async deleteEvent(eventId) {
    if (confirm('Are you sure you want to delete this appointment?')) {
      try {
        await this.db.collection('appointments').doc(eventId).delete();
        this.showMessage('Appointment deleted successfully!', 'success');
      } catch (error) {
        console.error('Error deleting appointment:', error);
        this.showMessage('Failed to delete appointment.', 'error');
      }
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

// Initialize schedule app
let scheduleApp;
document.addEventListener('DOMContentLoaded', () => {
  scheduleApp = new ScheduleApp();
});