/**
 * API Fallback Service - Provides fallback mechanisms for API endpoints
 */
class ApiFallbackService {
    constructor() {
        this.apiEndpoints = {
            scan: [
                'upload',
                'documents/upload',
                'scan/upload'
            ],
            matches: (docId) => [
                `scan/matches/${docId}`,
                `documents/matches/${docId}`,
                `matches/${docId}`
            ],
            document: (docId) => [
                `documents/${docId}`,
                `document/${docId}`
            ]
        };
        
        // In-memory cache for API responses
        this.responseCache = new Map();
        
        // Cache expiration time (10 minutes)
        this.cacheExpirationMs = 10 * 60 * 1000;
    }
    
    /**
     * Try multiple endpoints for a POST request with FormData
     */
    async tryFormDataEndpoints(type, formData) {
        const endpoints = this.apiEndpoints[type] || [];
        if (!endpoints.length) {
            throw new Error(`No endpoints defined for type: ${type}`);
        }
        
        for (let i = 0; i < endpoints.length; i++) {
            try {
                const endpoint = endpoints[i];
                console.log(`Trying ${type} endpoint: ${endpoint}`);
                
                const response = await fetch(ApiService.normalizeUrl(endpoint), {
                    method: 'POST',
                    body: formData,
                    credentials: 'include',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                });
                
                if (response.ok) {
                    console.log(`Successfully used endpoint: ${endpoint}`);
                    return await response.json();
                }
                
                console.warn(`Endpoint ${endpoint} returned ${response.status}`);
            } catch (error) {
                console.warn(`Endpoint ${endpoints[i]} failed:`, error.message);
            }
        }
        
        throw new Error(`All ${type} endpoints failed`);
    }
    
    /**
     * Try multiple endpoints for a POST request with JSON payload
     */
    async tryJsonEndpoints(type, jsonPayload) {
        const endpoints = this.apiEndpoints[type] || [];
        if (!endpoints.length) {
            throw new Error(`No endpoints defined for type: ${type}`);
        }
        
        for (let i = 0; i < endpoints.length; i++) {
            try {
                const endpoint = endpoints[i];
                console.log(`Trying JSON ${type} endpoint: ${endpoint}`);
                
                const response = await fetch(ApiService.normalizeUrl(endpoint), {
                    method: 'POST',
                    body: JSON.stringify(jsonPayload),
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                });
                
                if (response.ok) {
                    console.log(`Successfully used JSON endpoint: ${endpoint}`);
                    return await response.json();
                }
                
                console.warn(`JSON endpoint ${endpoint} returned ${response.status}`);
            } catch (error) {
                console.warn(`JSON endpoint ${endpoints[i]} failed:`, error.message);
            }
        }
        
        throw new Error(`All JSON ${type} endpoints failed`);
    }
    
    /**
     * Try multiple endpoints for a GET request
     */
    async tryGetEndpoints(type, param) {
        let endpoints = [];
        if (typeof this.apiEndpoints[type] === 'function') {
            endpoints = this.apiEndpoints[type](param);
        } else {
            endpoints = this.apiEndpoints[type] || [];
        }
        
        if (!endpoints.length) {
            throw new Error(`No endpoints defined for type: ${type}`);
        }
        
        // Create a cache key
        const cacheKey = `${type}:${param || ''}`;
        
        // Check cache first
        const cachedData = this.responseCache.get(cacheKey);
        if (cachedData && cachedData.expiration > Date.now()) {
            console.log(`Using cached data for ${cacheKey}`);
            return cachedData.data;
        }
        
        for (let i = 0; i < endpoints.length; i++) {
            try {
                const endpoint = endpoints[i];
                console.log(`Trying GET ${type} endpoint: ${endpoint}`);
                
                const response = await fetch(ApiService.normalizeUrl(endpoint), {
                    method: 'GET',
                    credentials: 'include',
                    headers: {
                        'Accept': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    console.log(`Successfully used ${type} endpoint: ${endpoint}`);
                    
                    // Cache the response
                    this.responseCache.set(cacheKey, {
                        data: data,
                        expiration: Date.now() + this.cacheExpirationMs
                    });
                    
                    return data;
                }
                
                console.warn(`${type} endpoint ${endpoint} returned ${response.status}`);
            } catch (error) {
                console.warn(`${type} endpoint ${endpoints[i]} failed:`, error.message);
            }
        }
        
        throw new Error(`All ${type} GET endpoints failed`);
    }
    
    /**
     * Clear the response cache
     */
    clearCache() {
        this.responseCache.clear();
        console.log('API response cache cleared');
    }
}

// Create a global instance
window.ApiFallback = new ApiFallbackService();
console.log('API Fallback Service initialized');
