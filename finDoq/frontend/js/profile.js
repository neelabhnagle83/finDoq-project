class ProfileController {
    constructor() {
        this.state = {
            username: '',
            credits: 0,
            documents: [],
            creditRequests: []
        };
        this.init();
    }

    async init() {
        await this.loadUserProfile();
        this.setupEventListeners();
        this.startAutoRefresh();
    }

    async loadUserProfile() {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/user/profile', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            this.updateProfileUI(data);
        } catch (error) {
            this.showNotification('error', 'Failed to load profile');
        }
    }

    updateProfileUI(data) {
        document.getElementById('username').textContent = data.username;
        document.getElementById('credits').textContent = data.credits;
        this.renderDocumentHistory(data.documents);
        this.renderCreditRequests(data.creditRequests);
    }

    renderDocumentHistory(documents) {
        const list = document.getElementById('documents-list');
        list.innerHTML = documents.map(doc => `
            <li class="document-item">
                <span>${doc.filename}</span>
                <span>${new Date(doc.uploadDate).toLocaleDateString()}</span>
                <button onclick="profile.downloadDocument(${doc.id})">Download</button>
            </li>
        `).join('');
    }

    showNotification(type, message) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }
}

// Initialize profile
const profile = new ProfileController();
