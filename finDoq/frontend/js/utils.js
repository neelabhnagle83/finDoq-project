// Utility functions for token management and API calls
const API_URL = 'http://localhost:3000/api';

class ApiService {
    static getHeaders() {
        const token = localStorage.getItem('token');
        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
    }

    static async fetchWithAuth(endpoint, options = {}) {
        try {
            const response = await fetch(`${API_URL}${endpoint}`, {
                ...options,
                headers: {
                    ...this.getHeaders(),
                    ...(options.headers || {})
                }
            });
            
            if (!response.ok) {
                throw new Error('API request failed');
            }
            
            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }
}

// Export for use in other files
window.ApiService = ApiService;
