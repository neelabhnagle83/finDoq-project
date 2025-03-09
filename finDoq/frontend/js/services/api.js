const BASE_URL = '/api'; // Remove http://localhost:3000 as we're using relative paths

export default class ApiService {
    static getHeaders() {
        return {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
        };
    }

    static async checkHealth() {
        const response = await fetch(`${BASE_URL}/health`);
        if (!response.ok) throw new Error('Server not responding');
        return response.json();
    }

    static async retryRequest(fn, retries = 3) {
        for (let i = 0; i < retries; i++) {
            try {
                return await fn();
            } catch (error) {
                if (i === retries - 1) throw error;
                await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
            }
        }
    }

    static async scanDocument(formData) {
        const response = await fetch(`${BASE_URL}/documents/scan`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            body: formData
        });
        return response.json();
    }

    static async checkDuplicate(content) {
        const response = await fetch(`${BASE_URL}/documents/check-duplicate`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ content })
        });
        if (!response.ok) throw new Error('Failed to check file');
        return response.json();
    }

    static async uploadDocument(formData) {
        const response = await fetch(`${BASE_URL}/documents/upload`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: formData
        });
        return response.json();
    }

    static async getUserProfile() {
        const response = await fetch(`${BASE_URL}/user/profile`, {
            headers: this.getHeaders()
        });
        return response.json();
    }

    static async getRecentFiles() {
        const response = await fetch(`${BASE_URL}/documents/recent`, {
            headers: this.getHeaders()
        });
        if (!response.ok) throw new Error('Failed to load recent files');
        return response.json();
    }

    static async deductCredit() {
        const response = await fetch(`${BASE_URL}/user/deduct-credit`, {
            method: 'POST',
            headers: this.getHeaders()
        });
        return response.json();
    }

    static async getSimilarities(content) {
        const response = await fetch(`${BASE_URL}/documents/similarities`, {
            method: 'POST',
            headers: { ...this.getHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ content })
        });
        return response.json();
    }

    static async requestCredits(amount) {
        return await fetch(`${BASE_URL}/credits/request`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ credits: amount })
        });
    }

    static async downloadDocument(id) {
        const response = await fetch(`${BASE_URL}/documents/${id}/download`, {
            headers: this.getHeaders()
        });
        return response.blob();
    }

    static async fetchWithAuth(endpoint, options = {}) {
        const baseUrl = '/api';
        const url = `${baseUrl}${endpoint}`;
        
        // Ensure headers exist
        if (!options.headers) {
            options.headers = {};
        }
        
        // Add Authorization header
        options.headers['Authorization'] = `Bearer ${localStorage.getItem('token')}`;
        
        // Add Content-Type if body is JSON
        if (options.body && typeof options.body === 'string' && !options.headers['Content-Type']) {
            options.headers['Content-Type'] = 'application/json';
        }
        
        try {
            const response = await fetch(url, options);
            
            // Check if response is ok (status in the range 200-299)
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(errorData.error || `API request failed with status ${response.status}`);
            }
            
            // Handle empty responses
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            } else {
                return {}; // Return empty object for non-JSON responses
            }
        } catch (error) {
            console.error(`API Error (${endpoint}):`, error);
            throw error;
        }
    }

    static isAuthenticated() {
        // Check if token exists and is not expired
        const token = localStorage.getItem('token');
        if (!token) return false;
        
        try {
            // Basic validation - in production you might want to verify with the server
            const payload = JSON.parse(atob(token.split('.')[1]));
            return payload.exp > Date.now() / 1000;
        } catch (e) {
            return false;
        }
    }

    static logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        window.location.href = '/login';
    }

    static setupWebSocket() {
        const token = localStorage.getItem('token');
        if (!token) return null;
        
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const userId = payload.id;
            
            const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
            const ws = new WebSocket(`${protocol}://${window.location.host}`);
            
            ws.onopen = () => {
                console.log('WebSocket connection established');
                ws.send(JSON.stringify({ type: 'subscribe', userId }));
            };
            
            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'CREDIT_UPDATE') {
                        document.dispatchEvent(new CustomEvent('creditUpdate', { detail: data }));
                    }
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            };
            
            return ws;
        } catch (e) {
            console.error('Error setting up WebSocket:', e);
            return null;
        }
    }
}
