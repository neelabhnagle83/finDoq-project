/**
 * Service for handling API interactions
 */
class ApiService {
    static isAuthenticated() {
        return localStorage.getItem('token') !== null;
    }
    
    static getHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        };
    }
    
    static setupWebSocket() {
        // Mock implementation
        console.log('Setting up WebSocket');
        return null;
    }
    
    static async fetchWithAuth(url, options = {}) {
        const baseOptions = {
            headers: this.getHeaders()
        };
        
        const mergedOptions = {
            ...baseOptions,
            ...options,
            headers: {
                ...baseOptions.headers,
                ...(options.headers || {})
            }
        };
        
        try {
            const response = await fetch(`/api${url}`, mergedOptions);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `API error: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error(`API call failed: ${url}`, error);
            
            // For testing/demo, return mock data based on URL pattern
            if (url.includes('document') || url.includes('matches')) {
                return this.getMockData(url);
            }
            
            throw error;
        }
    }
    
    static getMockData(url) {
        // For demo purposes, return reasonable mock data
        if (url.includes('/documents/recent')) {
            return [
                { id: 'doc1', filename: 'temp.txt', uploadDate: new Date().toISOString() },
                { id: 'doc2', filename: 'animals8.txt', uploadDate: new Date().toISOString() },
                { id: 'doc3', filename: 'animals.txt', uploadDate: new Date().toISOString() }
            ];
        }
        
        if (url.includes('/documents/')) {
            const docId = url.split('/').pop();
            if (docId === 'doc1') {
                return { id: 'doc1', filename: 'temp.txt', content: 'Lorem ipsum dolor sit amet...' };
            } else if (docId === 'doc2') {
                return { id: 'doc2', filename: 'animals8.txt', content: 'The quick brown fox...' };
            } else if (docId === 'doc3') {
                return { id: 'doc3', filename: 'animals.txt', content: 'The early bird catches...' };
            }
        }
        
        return { success: true };
    }
    
    static logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('userId');
        localStorage.removeItem('username');
        localStorage.removeItem('userRole');
        window.location.href = '/login';
    }
}

// Make available globally
window.ApiService = ApiService;
