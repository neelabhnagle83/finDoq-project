// Unique admin panel controller with state management
class AdminController {
    constructor() {
        this.state = {
            selectedFiles: new Set(),
            selectedUsers: new Set(),
            selectedRequests: new Set(),
            currentView: 'files'
        };
        this.init();
    }

    async init() {
        // Check if admin
        const userRole = localStorage.getItem('userRole');
        if (userRole !== 'admin') {
            window.location.href = '/login';
            return;
        }

        this.setupEventListeners();
        await this.loadCurrentView();
        this.setupRealtimeUpdates();
        this.loadCreditRequests();
        // Refresh every 30 seconds
        setInterval(() => this.loadCreditRequests(), 30000);
    }

    setupEventListeners() {
        // Add logout button handler
        document.querySelector('.signout-btn').addEventListener('click', () => {
            this.logout();
        });
    }

    logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('userId');
        localStorage.removeItem('username');
        localStorage.removeItem('userRole');
        window.location.href = '/login';
    }

    setupRealtimeUpdates() {
        // Poll for updates every 30 seconds
        setInterval(async () => {
            if (document.visibilityState === 'visible') {
                await this.loadCurrentView();
            }
        }, 30000);
    }

    async loadCurrentView() {
        const token = localStorage.getItem('token');
        if (!token) {
            window.location.href = '/login.html';
            return;
        }

        try {
            switch (this.state.currentView) {
                case 'files':
                    await this.loadFiles();
                    break;
                case 'users':
                    await this.loadUsers();
                    break;
                case 'notifications':
                    await this.loadCreditRequests();
                    break;
            }
        } catch (error) {
            this.showError(`Failed to load ${this.state.currentView}: ${error.message}`);
        }
    }

    // Unique error handling with auto-dismiss and retry option
    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-notification';
        errorDiv.innerHTML = `
            <p>${message}</p>
            <button onclick="adminController.loadCurrentView()">Retry</button>
            <button onclick="this.parentElement.remove()">Dismiss</button>
        `;
        document.body.appendChild(errorDiv);
        setTimeout(() => errorDiv.remove(), 5000);
    }

    // Innovative credit request handling with batch processing
    async handleCreditRequests(action) {
        const requests = Array.from(this.state.selectedRequests);
        if (!requests.length) {
            this.showError('No requests selected');
            return;
        }

        try {
            // Process in batches of 5 for better performance
            const batchSize = 5;
            for (let i = 0; i < requests.length; i += batchSize) {
                const batch = requests.slice(i, i + batchSize);
                await Promise.all(batch.map(id => 
                    fetch(`/api/admin/credit-requests/${id}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${localStorage.getItem('token')}`
                        },
                        body: JSON.stringify({ status: action })
                    })
                ));
            }
            await this.loadCreditRequests();
            this.showSuccess(`Successfully ${action} ${requests.length} requests`);
        } catch (error) {
            this.showError(`Failed to ${action} requests: ${error.message}`);
        }
    }

    // Dynamic analytics visualization
    async visualizeAnalytics(data) {
        const canvas = document.createElement('canvas');
        canvas.id = 'analyticsChart';
        document.querySelector('#analytics').appendChild(canvas);

        // Implement custom chart visualization here
        // This is just a placeholder - you would add your actual chart code
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#641074';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    async loadCreditRequests() {
        try {
            const response = await fetch('/api/admin/credit-requests', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            
            if (!response.ok) throw new Error('Failed to load requests');
            
            const requests = await response.json();
            this.renderRequests(requests);
        } catch (error) {
            this.showError('Failed to load credit requests');
            console.error(error);
        }
    }

    renderRequests(requests) {
        const container = document.getElementById('requests-container');
        if (!requests || requests.length === 0) {
            container.innerHTML = '<p>No pending credit requests</p>';
            return;
        }

        container.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Requested By</th>
                        <th>Amount</th>
                        <th>Request Date</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${requests.map(req => `
                        <tr>
                            <td>${req.username}</td>
                            <td>${req.requestedCredits} credits</td>
                            <td>${new Date(req.requestDate).toLocaleString()}</td>
                            <td>Pending</td>
                            <td>
                                <button onclick="adminController.handleRequest(${req.id}, 'approved')" class="approve-btn">Approve</button>
                                <button onclick="adminController.handleRequest(${req.id}, 'rejected')" class="reject-btn">Reject</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    async cleanupFiles() {
        try {
            const confirmCleanup = confirm('This will remove all invalid or unnamed files. Continue?');
            if (!confirmCleanup) return;

            const response = await fetch('/api/admin/cleanup', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) throw new Error('Cleanup failed');
            
            const result = await response.json();
            if (result.deletedCount > 0) {
                console.log('Deleted files:', result.deletedFiles); // For debugging
                this.showSuccess(`Cleaned up ${result.deletedCount} problematic files`);
            } else {
                this.showSuccess('No invalid files found');
            }
            await this.loadFiles(); // Refresh the files list
        } catch (error) {
            this.showError(error.message);
        }
    }

    async clearAllFiles() {
        try {
            const confirmClear = confirm('⚠️ Warning: This will permanently delete ALL files from the database. This action cannot be undone. Continue?');
            if (!confirmClear) return;

            const response = await fetch('/api/admin/clear-files', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) throw new Error('Database clear failed');
            
            const result = await response.json();
            this.showSuccess(result.message);
            await this.loadFiles(); // Refresh the files list
        } catch (error) {
            this.showError(error.message);
        }
    }

    renderFiles(files) {
        const tbody = document.getElementById('fileTableBody');
        if (!files || files.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6">No files found</td></tr>';
            return;
        }

        tbody.innerHTML = files.map((file, index) => {
            // Clean up filename display
            const displayName = file.filename && file.filename.includes('-') ? 
                file.filename.split('-').pop() : 
                file.filename;
                
            return `
                <tr>
                    <td>${index + 1}</td>
                    <td>${displayName || 'Unnamed File'}</td>
                    <td>${file.username || 'Unknown'}</td>
                    <td>${new Date(file.uploadDate).toLocaleString()}</td>
                    <td>${Math.round((file.size || 0) / 1024)} KB</td>
                    <td>
                        <button onclick="adminController.viewFile(${file.id})">View</button>
                        <button onclick="adminController.downloadFile(${file.id})">Download</button>
                        <button onclick="adminController.deleteFile(${file.id})" class="delete-btn">Delete</button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    async handleRequest(id, status) {
        try {
            const response = await fetch(`/api/admin/credit-requests/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ status })
            });

            if (!response.ok) throw new Error('Failed to update request');

            this.showSuccess(`Request ${status} successfully`);
            await this.loadCreditRequests(); // Refresh the list
        } catch (error) {
            this.showError(error.message);
        }
    }

    toggleRequest(checkbox) {
        if (checkbox.checked) {
            this.state.selectedRequests.add(checkbox.value);
        } else {
            this.state.selectedRequests.delete(checkbox.value);
        }
    }

    showSuccess(message) {
        const successDiv = document.createElement('div');
        successDiv.className = 'success-notification';
        successDiv.textContent = message;
        document.body.appendChild(successDiv);
        setTimeout(() => successDiv.remove(), 3000);
    }

    switchView(viewName) {    
        this.state.currentView = viewName;
        this.loadCurrentView();

        // Hide all sections
        document.querySelectorAll('.section-content').forEach(section => {
            section.classList.remove('active');
        });
        
        // Show selected section
        document.getElementById(viewName).classList.add('active');
        
        // Update navigation state
        document.querySelectorAll('.admin-navbar span').forEach(span => {
            span.classList.remove('active');
        });
        document.querySelector(`[onclick="adminController.switchView('${viewName}')"]`).classList.add('active');
    }

    async loadFiles() {
        try {
            const response = await fetch('/api/admin/files', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            
            if (!response.ok) throw new Error('Failed to load files');
            
            const files = await response.json();
            this.renderFiles(files);
        } catch (error) {
            this.showError(error.message);
        }
    }

    async loadUsers() {
        try {
            const response = await fetch('/api/admin/users', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            
            if (!response.ok) throw new Error('Failed to load users');
            
            const users = await response.json();
            this.renderUsers(users);
        } catch (error) {
            this.showError(error.message);
        }
    }

    renderUsers(users) {
        const tbody = document.getElementById('userTableBody');
        tbody.innerHTML = users.map((user, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${user.username}</td>
                <td>${user.role}</td>
                <td>${user.documentsCount || 0}</td>
                <td>${user.credits}</td>
                <td>${user.status}</td>
                <td>
                    <button onclick="adminController.addCredits(${user.id})" class="add-credits-btn">Add Credits</button>
                    ${user.role !== 'admin' ? `
                        <button onclick="adminController.toggleUserStatus(${user.id})" class="toggle-status-btn">
                            ${user.status === 'Active' ? 'Disable' : 'Enable'}
                        </button>
                    ` : ''}
                </td>
            </tr>
        `).join('');
    }

    async addCredits(userId) {
        const credits = prompt('Enter number of credits to add:');
        if (!credits || isNaN(credits)) return;

        try {
            const response = await fetch(`/api/admin/users/${userId}/credits`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ credits: parseInt(credits) })
            });

            if (!response.ok) throw new Error('Failed to add credits');
            
            this.showSuccess('Credits added successfully');
            await this.loadUsers();
        } catch (error) {
            this.showError(error.message);
        }
    }

    async handleCreditRequest(id, status) {
        try {
            const response = await fetch(`/api/admin/credit-requests/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ status })
            });

            if (!response.ok) throw new Error('Failed to update request');

            this.showSuccess(`Request ${status} successfully`);
            await this.loadCreditRequests(); // Refresh the list
        } catch (error) {
            this.showError(error.message);
        }
    }

    showSectionTabs() {
        const tabs = document.querySelectorAll('.admin-navbar span');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                this.switchView(tab.getAttribute('data-view'));
            });
        });
    }

    async viewFile(id) {
        try {
            const response = await fetch(`/api/admin/files/${id}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            
            if (!response.ok) throw new Error('Failed to load file');
            const file = await response.json();
            
            const modal = document.createElement('div');
            modal.className = 'view-modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>${file.filename}</h3>
                        <button onclick="this.closest('.view-modal').remove()">✕</button>
                    </div>
                    <div class="modal-body">
                        <pre>${file.content}</pre>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        } catch (error) {
            this.showError(error.message);
        }
    }

    async downloadFile(id) {
        try {
            const response = await fetch(`/api/admin/files/${id}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            
            if (!response.ok) throw new Error('Failed to load file');
            const file = await response.json();
            
            const blob = new Blob([file.content], { type: 'text/plain' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = file.filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            this.showError(error.message);
        }
    }

    async deleteFile(id) {
        if (!confirm('Are you sure you want to delete this file?')) return;

        try {
            const response = await fetch(`/api/admin/files/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            
            if (!response.ok) throw new Error('Failed to delete file');
            
            this.showSuccess('File deleted successfully');
            await this.loadFiles();
        } catch (error) {
            this.showError(error.message);
        }
    }
}

// Initialize controller
const adminController = new AdminController();

// Export for testing
if (typeof module !== 'undefined') {
    module.exports = AdminController;
}
