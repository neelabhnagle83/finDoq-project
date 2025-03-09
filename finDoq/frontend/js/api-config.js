/**
 * API Configuration Utility
 * 
 * This utility provides tools to diagnose and fix API connectivity issues.
 * It can be accessed via browser console with:
 * ApiConfig.checkEndpoints() - Test all endpoints
 * ApiConfig.setBaseUrl(url) - Change the API base URL
 */
class ApiConfig {
    // List of core API endpoints that should work
    static CORE_ENDPOINTS = [
        '/documents/scan',
        '/documents/upload', 
        '/documents/recent',
        '/credits/balance',
        '/user/profile'
    ];
    
    /**
     * Check connectivity to all core endpoints
     * @returns {Promise<object>} Results of all endpoint tests
     */
    static async checkEndpoints() {
        console.log('Testing API connectivity...');
        
        const baseUrl = ApiService.getApiBaseUrl();
        console.log(`Current API base URL: ${baseUrl}`);
        
        const results = {
            baseUrl,
            timestamp: new Date().toISOString(),
            endpoints: {},
            success: 0,
            failure: 0
        };
        
        for (const endpoint of this.CORE_ENDPOINTS) {
            try {
                console.log(`Testing endpoint: ${endpoint}`);
                
                const startTime = performance.now();
                const response = await fetch(`${baseUrl}${endpoint}`, {
                    method: 'OPTIONS',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                });
                const endTime = performance.now();
                
                const status = response.status;
                const method = response.headers.get('Allow') || 'Unknown';
                
                results.endpoints[endpoint] = {
                    status,
                    available: !(status === 404),
                    latency: Math.round(endTime - startTime),
                    method
                };
                
                if (status !== 404) {
                    results.success++;
                } else {
                    results.failure++;
                }
                
            } catch (error) {
                console.error(`Error testing ${endpoint}:`, error);
                results.endpoints[endpoint] = {
                    status: 'Error',
                    available: false,
                    error: error.message
                };
                results.failure++;
            }
        }
        
        // Print results in a nice format
        console.log('%cAPI Endpoint Test Results:', 'font-weight: bold; font-size: 14px;');
        console.log(`Base URL: ${results.baseUrl}`);
        console.log(`Success: ${results.success}, Failure: ${results.failure}`);
        
        Object.entries(results.endpoints).forEach(([endpoint, result]) => {
            const color = result.available ? 'color: green;' : 'color: red;';
            console.log(
                `%c${endpoint}: %c${result.available ? 'Available' : 'Not Available'} ${result.status}`,
                'font-weight: bold;',
                color
            );
        });
        
        return results;
    }
    
    /**
     * Set a new base URL for the API
     * @param {string} url The new base URL
     */
    static setBaseUrl(url) {
        ApiService.setApiBaseUrl(url);
        console.log(`API base URL set to: ${url}`);
        console.log('Run ApiConfig.checkEndpoints() to test the new URL');
    }
    
    /**
     * Fix common API configuration issues automatically
     */
    static autoFix() {
        console.log('Attempting to auto-fix API configuration...');
        
        // Try different base URLs
        const options = [
            'http://localhost:3000/api',
            'http://localhost:8000/api',
            'http://127.0.0.1:3000/api',
            `${window.location.origin}/api`
        ];
        
        // Store the current URL to restore if needed
        const currentUrl = ApiService.getApiBaseUrl();
        
        let bestOption = null;
        let bestScore = -1;
        
        const testPromises = options.map(async (url) => {
            try {
                ApiService.setApiBaseUrl(url);
                const results = await this.checkEndpoints();
                const score = results.success;
                
                if (score > bestScore) {
                    bestScore = score;
                    bestOption = url;
                }
                
                return { url, score };
            } catch (e) {
                return { url, score: -1 };
            }
        });
        
        Promise.all(testPromises).then(results => {
            if (bestOption && bestScore > 0) {
                console.log(`%cBest API URL found: ${bestOption} with ${bestScore} working endpoints`, 'color: green; font-weight: bold;');
                ApiService.setApiBaseUrl(bestOption);
                
                // Save this configuration
                localStorage.setItem('apiBaseUrl', bestOption);
            } else {
                console.log('%cNo working API URL found, restoring original', 'color: red;');
                ApiService.setApiBaseUrl(currentUrl);
            }
        });
    }
}

// Make ApiConfig available globally
window.ApiConfig = ApiConfig;

// Run auto-detection if configured to do so
document.addEventListener('DOMContentLoaded', () => {
    // Only run auto-detection in case of API errors
    if (parseInt(localStorage.getItem('apiErrorCount') || '0') > 3) {
        console.log('Multiple API errors detected, running auto-configuration...');
        setTimeout(() => ApiConfig.autoFix(), 1000);
    }
});
