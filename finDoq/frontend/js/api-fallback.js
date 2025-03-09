/**
 * API Fallback Service
 * Disabled - We're using actual API endpoints
 */
class ApiFallback {
    constructor() {
        // Disable by default - we don't want to use mock data
        this.enabled = false;
        console.log('API fallback is permanently disabled');
    }
    
    // Keep these functions for compatibility but make them inactive
    async checkApiAvailability() {
        return true; // Always return true, we want to use real API
    }
    
    interceptRequests() {
        // Do nothing - leave the original fetch untouched
    }
    
    async handleRequest() {
        throw new Error('API fallback is disabled');
    }
}

// Initialize with fallback disabled
document.addEventListener('DOMContentLoaded', () => {
    window.apiFallback = new ApiFallback();
});
