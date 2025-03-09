/**
 * Utility functions for finDoq application
 */

/**
 * API Service for authentication and data fetching
 */
class ApiService {
    /**
     * Check if user is authenticated
     * @returns {boolean}
     */
    static isAuthenticated() {
        return !!localStorage.getItem('token');
    }
    
    /**
     * Make authenticated API request
     * @param {string} url 
     * @param {object} options 
     * @returns {Promise<any>}
     */
    static async fetchWithAuth(url, options = {}) {
        const token = localStorage.getItem('token');
        
        // Ensure options are properly structured
        options.headers = options.headers || {};
        
        // Add authorization header if token exists
        if (token) {
            options.headers.Authorization = `Bearer ${token}`;
        }
        
        // Add content type if not specified and not FormData
        if (!options.headers['Content-Type'] && 
            !(options.body instanceof FormData)) {
            options.headers['Content-Type'] = 'application/json';
        }
        
        // Add credentials for cookies
        options.credentials = 'include';
        
        // Normalize URL - ensure it has the proper API prefix
        const apiUrl = ApiService.normalizeUrl(url);
        console.log(`Making API request to: ${apiUrl}`);
        
        try {
            const response = await fetch(apiUrl, options);
            
            // Handle unauthorized response (expired/invalid token)
            if (response.status === 401) {
                console.warn('Authentication failed, redirecting to login');
                localStorage.removeItem('token');
                window.location.href = '/login';
                throw new Error('Authentication failed');
            }
            
            // For all other non-OK responses, throw an error
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Server returned ${response.status}: ${response.statusText}`);
            }
            
            // Parse JSON if the response has content
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            }
            
            return await response.text();
            
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }
    
    /**
     * Normalize API URL to ensure it has the proper prefix
     * @param {string} url
     * @returns {string} Normalized URL
     */
    static normalizeUrl(url) {
        // If URL already has a protocol (http://, https://), return as is
        if (url.match(/^https?:\/\//)) {
            return url;
        }
        
        // Get the API base URL from config or use default
        const apiBase = ApiService.getApiBaseUrl();
        
        // Remove any /api/ prefix from the URL since the base already has it
        const cleanUrl = url.replace(/^\/?(api\/)?/, '').replace(/^\/+/, '');
        
        // Make sure the API base does not end with a slash
        const cleanBase = apiBase.replace(/\/+$/, '');
        
        // Log the clean URL for debugging
        console.log(`Normalized URL: ${url} → ${cleanBase}/${cleanUrl}`);
        
        // Combine with a slash
        return `${cleanBase}/${cleanUrl}`;
    }
    
    /**
     * Get the base URL for API calls
     * @returns {string} API base URL
     */
    static getApiBaseUrl() {
        // Check for saved config
        const savedBase = localStorage.getItem('apiBaseUrl');
        if (savedBase) return savedBase;
        
        // Use the environment variable or configuration value if available
        if (window.API_BASE_URL) return window.API_BASE_URL;
        
        // Default based on environment
        if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
            return 'http://localhost:3000/api';
        }
        
        // Production fallback - use same origin with /api path
        return `${window.location.origin}/api`;
    }
    
    /**
     * Set the API base URL manually
     * @param {string} baseUrl The new base URL for API calls
     */
    static setApiBaseUrl(baseUrl) {
        localStorage.setItem('apiBaseUrl', baseUrl);
        console.log(`API base URL set to: ${baseUrl}`);
    }
    
    /**
     * Try multiple endpoints until one works
     * @param {Array<string>} endpoints List of endpoints to try
     * @param {object} options Fetch options
     * @returns {Promise<any>} Response from the first successful endpoint
     */
    static async tryMultipleEndpoints(endpoints, options = {}) {
        let lastError = null;
        
        for (const endpoint of endpoints) {
            try {
                const result = await this.fetchWithAuth(endpoint, options);
                return result;
            } catch (error) {
                console.warn(`Endpoint ${endpoint} failed:`, error);
                lastError = error;
            }
        }
        
        throw lastError || new Error('All endpoints failed');
    }
    
    /**
     * Set up WebSocket connection for real-time updates
     * @returns {WebSocket|null}
     */
    static async setupWebSocket() {
        const token = localStorage.getItem('token');
        if (!token) {
            console.warn('Cannot setup WebSocket: No authentication token available');
            return null;
        }
        
        try {
            // Try multiple potential WebSocket URLs
            const protocols = location.protocol === 'https:' ? ['wss'] : ['ws'];
            const hosts = [location.host, 'localhost:3000'];
            
            let ws = null;
            let connected = false;
            
            // Try each protocol and host combination
            for (const protocol of protocols) {
                for (const host of hosts) {
                    if (connected) break;
                    
                    try {
                        const wsUrl = `${protocol}://${host}/api/ws?token=${token}`;
                        console.log(`Attempting WebSocket connection to: ${wsUrl}`);
                        
                        ws = new WebSocket(wsUrl);
                        
                        // Setup event handlers
                        ws.onopen = () => {
                            console.log(`WebSocket connected to: ${wsUrl}`);
                            connected = true;
                        };
                        
                        // Wait a bit to see if this connection works
                        await new Promise(resolve => setTimeout(resolve, 500));
                        
                        if (ws.readyState === WebSocket.OPEN) {
                            // This connection worked, break the loop
                            break;
                        }
                    } catch (wsError) {
                        console.warn(`WebSocket connection to ${protocol}://${host} failed:`, wsError);
                    }
                }
            }
            
            if (!ws || !connected) {
                console.warn('Could not establish WebSocket connection');
                return null;
            }
            
            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log('WebSocket message:', data);
                    
                    // Handle different types of messages
                    switch (data.type) {
                        case 'creditUpdate':
                            // Update credits display
                            document.dispatchEvent(new CustomEvent('creditUpdate', { 
                                detail: { credits: data.credits } 
                            }));
                            break;
                        case 'notification':
                            // Show notification
                            if (window.scanHandler) {
                                window.scanHandler.showNotification(
                                    data.notificationType || 'info',
                                    data.title || 'Notification',
                                    data.message
                                );
                            }
                            break;
                        default:
                            console.log('Unhandled WebSocket message type:', data.type);
                    }
                } catch (error) {
                    console.error('Error processing WebSocket message:', error);
                }
            };
            
            ws.onclose = () => {
                console.log('WebSocket connection closed');
                // Attempt to reconnect after a delay
                setTimeout(() => this.setupWebSocket(), 5000);
            };
            
            ws.onerror = (error) => {
                console.error('WebSocket error:', error);
            };
            
            return ws;
        } catch (error) {
            console.error('Failed to connect WebSocket:', error);
            return null;
        }
    }
    
    /**
     * Log out the current user
     */
    static logout() {
        // Clear all authentication data
        localStorage.removeItem('token');
        localStorage.removeItem('userId');
        localStorage.removeItem('username');
        localStorage.removeItem('userRole');
        
        // Redirect to login page - fix the path
        window.location.href = '/login';  // Changed from '/login.html' to '/login'
    }
}

// Make ApiService available globally
window.ApiService = ApiService;
