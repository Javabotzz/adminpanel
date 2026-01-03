// services-view.js - WITH WORKING EDIT & DELETE
class ServicesView {
  constructor() {
    this.currentView = 'grid';
    this.services = [];
    this.modal = null;
  }
  
  async init() {
    await this.loadServices();
    this.createModal();
    this.renderServices();
  }
  
  createModal() {
    // Create modal HTML
    const modalHTML = `
            <div class="services-modal" id="servicesModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Services Overview</h3>
                        <button class="modal-close" onclick="servicesView.closeModal()">✕ Close</button>
                    </div>
                    <div class="modal-body" id="modalBody">
                        <!-- Content will be loaded here -->
                    </div>
                </div>
            </div>
        `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    this.modal = document.getElementById('servicesModal');
  }
  
  switchView(viewType) {
    this.currentView = viewType;
    
    // Update active buttons
    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === viewType);
    });
    
    if (viewType === 'grid') {
      // Grid view stays in main page
      this.closeModal();
      this.renderServices();
    } else {
      // List and Table views open in modal
      this.openModal();
      this.renderModalContent();
    }
  }
  
  openModal() {
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
    this.currentView = 'grid';
    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === 'grid');
    });
    this.renderServices();
  }
  
  async loadServices() {
    try {
      const snapshot = await firebase.firestore().collection('services').get();
      this.services = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      console.log('Loaded services:', this.services.length);
    } catch (error) {
      console.error('Error loading services:', error);
      this.showError('Failed to load services');
    }
  }
  
  renderServices() {
    const container = document.getElementById('servicesList');
    
    if (!container) return;
    
    if (this.services.length === 0) {
      container.innerHTML = '<div class="no-services">No services found</div>';
      return;
    }
    
    if (this.currentView === 'grid') {
      container.className = 'services-grid-view';
      container.innerHTML = this.renderGridView();
    } else {
      container.innerHTML = '<div class="no-services">Switch to Grid view or click List/Table to open full view</div>';
    }
  }
  
  renderModalContent() {
    const modalBody = document.getElementById('modalBody');
    if (!modalBody) return;
    
    if (this.services.length === 0) {
      modalBody.innerHTML = '<div class="no-services">No services found</div>';
      return;
    }
    
    switch (this.currentView) {
      case 'list':
        modalBody.className = 'services-list-view';
        modalBody.innerHTML = this.renderListView();
        break;
      case 'table':
        modalBody.innerHTML = this.renderTableView();
        break;
    }
  }
  
  // GRID: Card layout
  renderGridView() {
    return this.services.map(service => `
            <div class="service-card">
                <h4>${service.name || 'Unnamed Service'}</h4>
                <div class="service-price">KSh ${service.price || 0}</div>
                ${service.description ? `<div class="service-desc">${service.description}</div>` : ''}
                <div class="service-meta">
                    <span>${service.duration || 0} mins</span>
                    <span class="service-category">${service.category || 'General'}</span>
                </div>
                <div class="service-actions">
                    <button class="btn-sm btn-edit" onclick="servicesView.editService('${service.id}')">Edit</button>
                    <button class="btn-sm btn-delete" onclick="servicesView.deleteService('${service.id}')">Delete</button>
                </div>
            </div>
        `).join('');
  }
  
  // LIST: Full screen in modal
  renderListView() {
    return this.services.map(service => `
            <div class="service-list">
                <div class="service-list-info">
                    <strong>${service.name || 'Unnamed Service'}</strong>
                    <span class="service-price">KSh ${service.price || 0}</span>
                    <span>${service.duration || 0} mins</span>
                    <span class="service-category">${service.category || 'General'}</span>
                    ${service.description ? `<span>${service.description}</span>` : ''}
                </div>
                <div class="service-actions">
                    <button class="btn-sm btn-edit" onclick="servicesView.editService('${service.id}')">Edit</button>
                    <button class="btn-sm btn-delete" onclick="servicesView.deleteService('${service.id}')">Delete</button>
                </div>
            </div>
        `).join('');
  }
  
  // TABLE: Full screen in modal
  renderTableView() {
    return `
            <table class="services-table-view">
                <thead>
                    <tr>
                        <th>Service Name</th>
                        <th>Price</th>
                        <th>Duration</th>
                        <th>Category</th>
                        <th>Description</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.services.map(service => `
                        <tr>
                            <td><strong>${service.name || 'Unnamed Service'}</strong></td>
                            <td>KSh ${service.price || 0}</td>
                            <td>${service.duration || 0} mins</td>
                            <td>${service.category || 'General'}</td>
                            <td>${service.description || '-'}</td>
                            <td class="service-actions">
                                <button class="btn-sm btn-edit" onclick="servicesView.editService('${service.id}')">Edit</button>
                                <button class="btn-sm btn-delete" onclick="servicesView.deleteService('${service.id}')">Delete</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
  }
  
  // EDIT SERVICE FUNCTION
  async editService(serviceId) {
    try {
      console.log('Editing service:', serviceId);
      
      // Find the service data
      const service = this.services.find(s => s.id === serviceId);
      if (!service) {
        alert('Service not found!');
        return;
      }
      
      // Create edit form modal
      this.showEditForm(service);
      
    } catch (error) {
      console.error('Error editing service:', error);
      this.showError('Failed to edit service');
    }
  }
  
  // DELETE SERVICE FUNCTION
  async deleteService(serviceId) {
    try {
      if (!confirm('Are you sure you want to delete this service? This action cannot be undone.')) {
        return;
      }
      
      console.log('Deleting service:', serviceId);
      
      // Show loading
      this.showMessage('Deleting service...', 'info');
      
      // Delete from Firebase
      await firebase.firestore().collection('services').doc(serviceId).delete();
      
      // Remove from local array
      this.services = this.services.filter(s => s.id !== serviceId);
      
      // Re-render views
      this.renderServices();
      this.renderModalContent();
      
      this.showMessage('Service deleted successfully!', 'success');
      
    } catch (error) {
      console.error('Error deleting service:', error);
      this.showError('Failed to delete service: ' + error.message);
    }
  }
  
  // SHOW EDIT FORM
  showEditForm(service) {
    const editFormHTML = `
            <div class="services-modal active" id="editServiceModal">
                <div class="modal-content" style="max-width: 500px;">
                    <div class="modal-header">
                        <h3>✏️ Edit Service</h3>
                        <button class="modal-close" onclick="servicesView.closeEditForm()">✕ Close</button>
                    </div>
                    <div class="modal-body">
                        <form id="editServiceForm" style="padding: 20px;">
                            <div style="margin-bottom: 15px;">
                                <label><strong>Service Name</strong></label>
                                <input type="text" id="editServiceName" value="${service.name}" required 
                                       style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                            </div>
                            
                            <div style="margin-bottom: 15px;">
                                <label><strong>Description</strong></label>
                                <textarea id="editServiceDesc" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px; height: 80px;">${service.description || ''}</textarea>
                            </div>
                            
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                                <div>
                                    <label><strong>Duration (minutes)</strong></label>
                                    <input type="number" id="editServiceDuration" value="${service.duration}" required 
                                           style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                                </div>
                                <div>
                                    <label><strong>Price (KSh)</strong></label>
                                    <input type="number" id="editServicePrice" value="${service.price}" required 
                                           style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                                </div>
                            </div>
                            
                            <div style="margin-bottom: 20px;">
                                <label><strong>Category</strong></label>
                                <select id="editServiceCategory" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                                    <option value="">Select Category</option>
                                    <option value="Massage" ${service.category === 'Massage' ? 'selected' : ''}>Massage</option>
                                    <option value="Facial" ${service.category === 'Facial' ? 'selected' : ''}>Facial</option>
                                    <option value="Therapy" ${service.category === 'Therapy' ? 'selected' : ''}>Therapy</option>
                                    <option value="Yoga" ${service.category === 'Yoga' ? 'selected' : ''}>Yoga</option>
                                    <option value="Nails" ${service.category === 'Nails' ? 'selected' : ''}>Nails</option>
                                    <option value="Wellness" ${service.category === 'Wellness' ? 'selected' : ''}>Wellness</option>
                                    <option value="Beauty" ${service.category === 'Beauty' ? 'selected' : ''}>Beauty</option>
                                </select>
                            </div>
                            
                            <div style="display: flex; gap: 10px;">
                                <button type="submit" style="flex: 1; padding: 12px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">
                                    💾 Update Service
                                </button>
                                <button type="button" onclick="servicesView.closeEditForm()" style="padding: 12px 20px; background: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer;">
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
    
    document.body.insertAdjacentHTML('beforeend', editFormHTML);
    
    // Handle form submission
    document.getElementById('editServiceForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.updateService(service.id);
    });
  }
  
  // CLOSE EDIT FORM
  closeEditForm() {
    const editModal = document.getElementById('editServiceModal');
    if (editModal) {
      editModal.remove();
    }
  }
  
  // UPDATE SERVICE IN FIREBASE
  async updateService(serviceId) {
    try {
      const updatedData = {
        name: document.getElementById('editServiceName').value,
        description: document.getElementById('editServiceDesc').value,
        duration: parseInt(document.getElementById('editServiceDuration').value),
        price: parseInt(document.getElementById('editServicePrice').value),
        category: document.getElementById('editServiceCategory').value,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      
      // Validate data
      if (!updatedData.name || !updatedData.duration || !updatedData.price) {
        alert('Please fill in all required fields!');
        return;
      }
      
      // Show loading
      this.showMessage('Updating service...', 'info');
      
      // Update in Firebase
      await firebase.firestore().collection('services').doc(serviceId).update(updatedData);
      
      // Update local data
      const serviceIndex = this.services.findIndex(s => s.id === serviceId);
      if (serviceIndex !== -1) {
        this.services[serviceIndex] = { ...this.services[serviceIndex], ...updatedData };
      }
      
      // Close edit form
      this.closeEditForm();
      
      // Re-render views
      this.renderServices();
      this.renderModalContent();
      
      this.showMessage('Service updated successfully!', 'success');
      
    } catch (error) {
      console.error('Error updating service:', error);
      this.showError('Failed to update service: ' + error.message);
    }
  }
  
  // UTILITY FUNCTIONS
  showMessage(message, type = 'info') {
    // Simple alert for now - you can replace with toast notifications
    if (type === 'success') {
      alert('✅ ' + message);
    } else if (type === 'error') {
      alert('❌ ' + message);
    } else {
      alert('ℹ️ ' + message);
    }
  }
  
  showError(message) {
    this.showMessage(message, 'error');
  }
}

// Initialize the services view
const servicesView = new ServicesView();

// Load when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  servicesView.init();
});