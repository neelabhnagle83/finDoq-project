/**
 * ScanHandler - Manages document scanning and results display
 */
class ScanHandler {
    constructor() {
        this.scanBtn = document.getElementById('upload-scan-btn');
        this.cancelBtn = document.getElementById('cancel-upload-btn');
        this.loadingOverlay = document.getElementById('loading-overlay');
        this.matchesList = document.getElementById('matches-list');
        this.resultsContainer = document.getElementById('scan-results-container') || this.createResultsContainer();
        
        // Remove mock data usage completely
        this.useMockData = false;
        
        this.activeNotifications = 0; // Track active notifications
        this.userCredits = document.getElementById('credits-display') || null; // Track user credits element
        
        // Add cache for document content to prevent unnecessary refreshing
        this.documentCache = {};
        // Track last displayed results with hash for better comparison
        this.lastResultsHash = null;

        this.setupEventListeners();
        
        // Add modal container check and initialization
        this.initializeModals();
    }

    setupEventListeners() {
        if (this.scanBtn) {
            this.scanBtn.addEventListener('click', this.handleScan.bind(this));
        }
        
        if (this.cancelBtn) {
            this.cancelBtn.addEventListener('click', this.handleCancel.bind(this));
        }
    }

    createResultsContainer() {
        // Create results container if it doesn't exist
        const container = document.createElement('div');
        container.id = 'scan-results-container';
        container.className = 'scan-results-container';
        container.style.margin = '30px auto';
        container.style.maxWidth = '800px';
        container.style.backgroundColor = 'rgba(48, 8, 55, 0.4)';
        container.style.borderRadius = '10px';
        container.style.padding = '20px';
        container.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.2)';
        container.style.display = 'none'; // Initially hidden
        
        // Create header
        const header = document.createElement('div');
        header.className = 'results-header';
        header.innerHTML = '<h2>Scan Results</h2>';
        header.style.marginBottom = '20px';
        header.style.borderBottom = '1px solid rgba(255, 255, 255, 0.2)';
        header.style.paddingBottom = '10px';
        
        // Create content area
        const content = document.createElement('div');
        content.id = 'matches-list';
        content.className = 'matches-list';
        
        container.appendChild(header);
        container.appendChild(content);
        
        // Add after the drop area
        const dropArea = document.getElementById('drop-area');
        if (dropArea && dropArea.parentNode) {
            dropArea.parentNode.insertBefore(container, dropArea.nextSibling);
        } else {
            document.body.appendChild(container);
        }
        
        this.matchesList = content;
        return container;
    }

    handleScan() {
        const fileInput = document.getElementById('document-file');
        if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
            this.showNotification('error', 'No file selected', 'Please select a document to scan.');
            return;
        }

        // Check if user has enough credits
        const currentCredits = this.getCurrentCredits();
        if (currentCredits <= 0) {
            this.showNotification('error', 'No Credits Available', 'You have no credits remaining. Please wait for the daily reset or contact an admin.');
            // Exit the function early if no credits
            return;
        }

        const file = fileInput.files[0];
        this.startScanProcess(file);
    }

    handleCancel() {
        const filePreview = document.getElementById('file-preview');
        const dropZonePrompt = document.querySelector('.drop-zone-prompt');
        
        if (filePreview) filePreview.classList.add('hidden');
        if (dropZonePrompt) dropZonePrompt.classList.remove('hidden');
        
        // Reset file input
        const fileInput = document.getElementById('document-file');
        if (fileInput) fileInput.value = '';
    }

    startScanProcess(file) {
        this.showLoading('Analyzing document for similarities...');
        
        // Hide previous results while loading
        if (this.resultsContainer) {
            this.resultsContainer.style.display = 'none';
        }
        
        // Always cache the file content for later use
        this.readFileContent(file)
            .then(content => {
                // Store the file content in memory for preview purposes
                this.cacheDocumentContent(`temp_${file.name}`, {
                    filename: file.name,
                    content: content
                });
                
                // Also store in a session variable to ensure it's available
                sessionStorage.setItem(`file_content_${file.name}`, content);
            })
            .catch(err => console.warn('Could not read file content for cache:', err));
        
        // Deduct credit before scanning - but don't deduct if it fails later
        const initialCredits = this.getCurrentCredits();
        
        // Make the actual API call
        const formData = new FormData();
        formData.append('document', file);
        formData.append('filename', file.name); // Add filename explicitly
        
        // Add content type as a separate field for backends that need it
        formData.append('contentType', file.type || 'text/plain');
        
        // Store a reference to the file for use in error handling
        this._lastScannedFile = file;
        
        // Updated endpoints with correct API paths based on the backend routes
        const endpoints = [
            'upload',              // From backend/routes/scan.js route
            'documents/upload',     // Alternative endpoint
            'scan/upload',         // Another possibility
            'scan'                 // Last resort simple endpoint
        ];
        
        // Track if we've actually deducted credits yet
        let creditsDeducted = false;
        
        this.tryApiEndpoints(endpoints, formData)
            .then(data => {
                // If scan succeeded, now deduct the credit
                if (!creditsDeducted) {
                    this.deductCredit();
                    creditsDeducted = true;
                }
                
                this.hideLoading();
                
                // Check if we got a success response
                if (data && (data.success !== false)) {
                    // Try to enhance the results with the actual file content
                    this.enhanceResultsWithFileContent(data, file);
                    
                    // If we have document ID, fetch matches right away
                    if (data.documentId) {
                        this.fetchAndDisplayMatches(data.documentId, file.name);
                    } else {
                        this.displayScanResults(data);
                    }
                } else {
                    throw new Error(data?.message || 'Failed to scan document');
                }
            })
            .catch(error => {
                this.hideLoading();
                
                // Only show the retry option if the error is network-related
                const isNetworkError = error.message && (
                    error.message.includes('Failed to fetch') || 
                    error.message.includes('NetworkError') || 
                    error.message.includes('404') ||
                    error.message.includes('All API endpoints failed')
                );
                
                if (isNetworkError) {
                    // Create a retry function
                    const retryFn = () => {
                        this.showNotification('info', 'Retrying', 'Attempting to scan document again...');
                        
                        // Attempt with a JSON payload instead of FormData as fallback
                        this.readFileContent(file).then(content => {
                            const jsonPayload = {
                                filename: file.name,
                                content: content,
                                fileType: file.type || 'text/plain'
                            };
                            
                            // Updated JSON endpoints to match backend routes
                            const jsonEndpoints = [
                                'upload',          // Main upload endpoint
                                'documents/upload', // Alternative
                                'scan/upload'      // Another option
                            ];
                            
                            // Try JSON-based endpoints with actual content
                            this.tryJsonEndpoints(jsonEndpoints, jsonPayload)
                                .then(data => {
                                    if (!creditsDeducted) {
                                        this.deductCredit();
                                        creditsDeducted = true;
                                    }
                                    
                                    this.hideLoading();
                                    
                                    // Check if we got a success response
                                    if (data && (data.success !== false)) {
                                        this.enhanceResultsWithFileContent(data, file);
                                        
                                        // If we have document ID, fetch matches right away
                                        if (data.documentId) {
                                            this.fetchAndDisplayMatches(data.documentId, file.name);
                                        } else {
                                            this.displayScanResults(data);
                                        }
                                    } else {
                                        throw new Error(data?.message || 'Failed to scan document');
                                    }
                                })
                                .catch(jsonError => {
                                    this.hideLoading();
                                    this.handleScanFailure(jsonError, file, parseInt(localStorage.getItem('apiErrorCount') || '0'));
                                });
                        });
                    };
                    
                    // Show error with retry option
                    this.showErrorWithRetry(error, 'Scan Failed', 
                        'Unable to scan document. The server might be busy.', retryFn);
                } else {
                    // For non-network errors, just show the regular error
                    this.handleScanFailure(error, file, parseInt(localStorage.getItem('apiErrorCount') || '0'));
                }
            });
    }

    // Add a new method to fetch and display matches for a document ID
    fetchAndDisplayMatches(docId, fileName) {
        this.showLoading('Finding similar documents...');
        
        // Try multiple endpoint patterns for matches
        const matchEndpoints = [
            `scan/matches/${docId}`,
            `documents/matches/${docId}`,
            `matches/${docId}`
        ];

        // Try each endpoint sequentially
        this.tryGetEndpoints(matchEndpoints, 0)
            .then(data => {
                this.hideLoading();
                // Try to enhance the matches with the cached content
                const cachedFile = this.getDocumentFromCache(`temp_${fileName}`);
                if (cachedFile && data.matches) {
                    this.enhanceMatchesWithContent(data.matches, fileName, cachedFile.content);
                }
                this.displayScanResults(data);
            })
            .catch(error => {
                this.hideLoading();
                console.error('Error fetching matches:', error);
                
                // Create a fallback matches display with just the original document
                const fallbackData = {
                    matches: [{
                        id: docId,
                        documentId: docId,
                        filename: fileName,
                        documentName: fileName,
                        similarity: 100,
                        isCurrentFile: true,
                        content: cachedFile ? cachedFile.content : 'Content not available',
                        previewContent: cachedFile ? cachedFile.content.substring(0, 200) : 'Content not available'
                    }]
                };
                
                this.displayScanResults(fallbackData);
                this.showNotification('warning', 'Limited Results', 
                    'Could not fetch all similarity matches. Results may be incomplete.');
            });
    }

    // Try multiple endpoints with a single consolidated method
    async tryApiEndpoints(endpoints, formData) {
        for (let i = 0; i < endpoints.length; i++) {
            try {
                // Use ApiService to normalize URL and handle authentication
                const endpoint = endpoints[i];
                console.log(`Trying scan endpoint: ${endpoint}`);
                
                const response = await fetch(ApiService.normalizeUrl(endpoint), {
                    method: 'POST',
                    body: formData,
                    credentials: 'include',
                    headers: {
                        // Don't set Content-Type for FormData
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                });
                
                if (response.ok) {
                    // Reset error counter on successful connection
                    localStorage.setItem('apiErrorCount', '0');
                    console.log(`Successfully used endpoint: ${endpoint}`);
                    return await response.json();
                }
                
                // If we get a redirect, follow it (fix for some server configurations)
                if (response.status === 301 || response.status === 302 || response.status === 307) {
                    const redirectUrl = response.headers.get('Location');
                    if (redirectUrl) {
                        console.log(`Following redirect to: ${redirectUrl}`);
                        const redirectResponse = await fetch(redirectUrl, {
                            method: 'POST',
                            body: formData,
                            credentials: 'include',
                            headers: {
                                'Authorization': `Bearer ${localStorage.getItem('token')}`
                            }
                        });
                        
                        if (redirectResponse.ok) {
                            return await redirectResponse.json();
                        }
                    }
                }
                
                console.warn(`Endpoint ${endpoint} returned ${response.status}`);
            } catch (error) {
                console.warn(`Endpoint ${endpoints[i]} failed:`, error.message);
            }
        }
        
        throw new Error('All API endpoints failed');
    }
    
    // New method to try JSON-based endpoints
    async tryJsonEndpoints(endpoints, jsonPayload) {
        for (let i = 0; i < endpoints.length; i++) {
            try {
                // Use ApiService to normalize URL and handle authentication
                const endpoint = endpoints[i];
                console.log(`Trying JSON endpoint: ${endpoint}`);
                
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
                    // Reset error counter on successful connection
                    localStorage.setItem('apiErrorCount', '0');
                    console.log(`Successfully used JSON endpoint: ${endpoint}`);
                    return await response.json();
                }
                
                // If we get a redirect, follow it
                if (response.status === 301 || response.status === 302 || response.status === 307) {
                    const redirectUrl = response.headers.get('Location');
                    if (redirectUrl) {
                        console.log(`Following redirect to: ${redirectUrl}`);
                        const redirectResponse = await fetch(redirectUrl, {
                            method: 'POST',
                            body: JSON.stringify(jsonPayload),
                            credentials: 'include',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${localStorage.getItem('token')}`
                            }
                        });
                        
                        if (redirectResponse.ok) {
                            return await redirectResponse.json();
                        }
                    }
                }
                
                console.warn(`JSON endpoint ${endpoint} returned ${response.status}`);
            } catch (error) {
                console.warn(`JSON endpoint ${endpoints[i]} failed:`, error.message);
            }
        }
        
        throw new Error('All JSON API endpoints failed');
    }
    
    // Add a new method to try multiple GET endpoints sequentially
    async tryGetEndpoints(endpoints, index) {
        if (index >= endpoints.length) {
            throw new Error('All API endpoints failed');
        }
        
        try {
            // Use ApiService to normalize URL
            const endpoint = endpoints[index];
            console.log(`Trying GET endpoint: ${endpoint}`);
            
            const response = await fetch(ApiService.normalizeUrl(endpoint), {
                method: 'GET',
                credentials: 'include',
                headers: { 
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (!response.ok) {
                // If we get a redirect, follow it
                if (response.status === 301 || response.status === 302 || response.status === 307) {
                    const redirectUrl = response.headers.get('Location');
                    if (redirectUrl) {
                        console.log(`Following redirect to: ${redirectUrl}`);
                        const redirectResponse = await fetch(redirectUrl, {
                            method: 'GET',
                            credentials: 'include',
                            headers: { 
                                'Accept': 'application/json',
                                'Authorization': `Bearer ${localStorage.getItem('token')}`
                            }
                        });
                        
                        if (redirectResponse.ok) {
                            return await redirectResponse.json();
                        }
                    }
                }
                
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }
            
            console.log(`Successfully used endpoint: ${endpoint}`);
            return await response.json();
        } catch (error) {
            console.warn(`Endpoint ${endpoints[index]} failed:`, error.message);
            
            // Try the next endpoint
            return this.tryGetEndpoints(endpoints, index + 1);
        }
    }

    showExistingMatches(filename) {
        this.showLoading('Retrieving existing matches...');
        
        // Try multiple endpoint formats to improve compatibility - remove leading slashes
        const endpoints = [
            `documents/matches?filename=${encodeURIComponent(filename)}`,
            `scan/matches?filename=${encodeURIComponent(filename)}`,
            `matches?filename=${encodeURIComponent(filename)}`
        ];
        
        // Try each endpoint sequentially
        this.tryGetEndpoints(endpoints, 0)
            .then(data => {
                this.hideLoading();
                if (data.matches && data.matches.length > 0) {
                    // Try to enhance results with actual file content
                    const cachedFile = this.getDocumentFromCache(`temp_${filename}`);
                    if (cachedFile) {
                        this.enhanceMatchesWithContent(data.matches, filename, cachedFile.content);
                    }
                    this.displayScanResults({ matches: data.matches });
                } else {
                    throw new Error('No existing matches found');
                }
            })
            .catch(error => {
                this.hideLoading();
                this.handleApiError(error);
            });
    }

    handleScanFailure(error, file, apiErrorCount) {
        this.hideLoading();
        console.error('Scan error:', error);
        
        // Increment error counter for tracking persistent issues
        if (error.message && (error.message.includes('Failed to fetch') || 
            error.message.includes('NetworkError') || 
            error.message.includes('404'))) {
            apiErrorCount++;
            localStorage.setItem('apiErrorCount', apiErrorCount.toString());
            
            // Suggest API diagnostics after multiple errors
            if (apiErrorCount > 2) {
                this.showNotification('warning', 'API Connection Issue', 
                    'Please use the API Diagnostics tool to fix connection problems.');
                
                // Add link to diagnostics page if it's not already there
                if (!document.querySelector('.diagnostics-link')) {
                    const header = document.querySelector('header');
                    
                    if (header) {
                        const diagnosticsLink = document.createElement('a');
                        diagnosticsLink.href = '/api-diagnostics.html';
                        diagnosticsLink.className = 'diagnostics-link';
                        diagnosticsLink.innerHTML = '<span>⚠️ Fix API</span>';
                        diagnosticsLink.style.color = '#ff9800';
                        diagnosticsLink.style.marginLeft = '10px';
                        diagnosticsLink.style.textDecoration = 'none';
                        
                        const navArea = header.querySelector('.user-actions');
                        if (navArea) {
                            navArea.insertBefore(diagnosticsLink, navArea.firstChild);
                        } else {
                            header.appendChild(diagnosticsLink);
                        }
                    }
                }
            }
        }
        
        // More specific error messages based on error type
        if (error.message && error.message.includes('404')) {
            this.showNotification('error', 'Scan Failed', 
                'The scan service is unavailable. Please use the API Diagnostics tool to fix connection issues.');
        } else if (error.message && error.message.includes('All API endpoints failed')) {
            this.showNotification('error', 'Connection Issue', 
                'Unable to reach the scan service. Please check your internet connection or API configuration.');
        } else {
            this.showNotification('error', 'Scan Failed', 
                'Unable to scan document. Please try again later or contact support.');
        }
    }

    // Helper method to try multiple deduct endpoints
    async tryDeductEndpoints(endpoints, index) {
        if (index >= endpoints.length) {
            throw new Error('All deduct endpoints failed');
        }
        
        try {
            // Use ApiService to normalize URL
            const endpoint = endpoints[index];
            console.log(`Trying deduct endpoint: ${endpoint}`);
            
            const response = await fetch(ApiService.normalizeUrl(endpoint), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ deduct: 1 }),
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error(`Failed to update credits: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.warn(`Endpoint ${endpoints[index]} failed:`, error.message);
            
            // Try the next endpoint
            return this.tryDeductEndpoints(endpoints, index + 1);
        }
    }

    // Deduct 1 credit after scanning with improved endpoint handling
    deductCredit() {
        if (this.userCredits) {
            const currentCredits = this.getCurrentCredits();
            if (currentCredits > 0) {
                const newCredits = currentCredits - 1;
                // Use the updateCreditsUI method for consistency
                this.updateCreditsUI(newCredits);
                
                // Update credits in server - remove /api/ prefix
                const endpoints = [
                    'credits/deduct', 
                    'user/credits/deduct',
                    'account/credits/deduct'
                ];
                
                // Try each endpoint until one works
                this.tryDeductEndpoints(endpoints, 0)
                    .then(data => {
                        console.log('Credit deduction response:', data);
                        // Update UI with server's credit value to ensure consistency
                        if (data.creditsRemaining !== undefined) {
                            this.updateCreditsUI(data.creditsRemaining);
                            localStorage.setItem('userCredits', data.creditsRemaining);
                        } else if (data.credits !== undefined) {
                            this.updateCreditsUI(data.credits);
                            localStorage.setItem('userCredits', data.credits);
                        }
                    })
                    .catch(err => {
                        console.error('Failed to update credits with all endpoints:', err);
                        // Don't revert UI - keep the deducted credit since we did perform a scan
                        this.showNotification('warning', 'Credits Status', 'Credit deduction will be processed shortly');
                    });
                
                return true;
            }
            return false;
        }
        return true; // Default to success if element not found
    }

    showErrorWithRetry(error, title, message, retryFn) {
        console.error('Scan error with retry option:', error);
        
        // Create notification container if it doesn't exist
        const notificationContainer = document.querySelector('.notification-container') || 
            (() => {
                const container = document.createElement('div');
                container.className = 'notification-container';
                document.body.appendChild(container);
                return container;
            })();
        
        const notification = document.createElement('div');
        notification.className = 'notification error';
        notification.innerHTML = `
            <div class="notification-content">
                <h4>${title}</h4>
                <p>${message}</p>
                <div class="notification-actions">
                    <button class="retry-btn">Try Again</button>
                </div>
            </div>
            <button class="notification-close">&times;</button>
        `;
        
        // Add retry functionality
        const retryBtn = notification.querySelector('.retry-btn');
        if (retryBtn && retryFn) {
            retryBtn.addEventListener('click', () => {
                notification.remove();
                this.activeNotifications--;
                retryFn();
            });
        }
        
        // Add close functionality
        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.classList.add('fade-out');
            setTimeout(() => {
                notification.remove();
                this.activeNotifications--;
            }, 300);
        });
        
        // Add to container
        notificationContainer.appendChild(notification);
        this.activeNotifications++;
        
        // Auto-dismiss after longer period (8 seconds)
        setTimeout(() => {
            if (notification.parentNode) {
                notification.classList.add('fade-out');
                setTimeout(() => {
                    notification.remove();
                    this.activeNotifications--;
                }, 300);
            }
        }, 8000);
    }

    handleApiError(error, fallbackAction) {
        console.error('API Error:', error);
        
        // Only show one notification per error
        if (error.handled) {
            return; // Skip showing another notification for this error
        }
        
        error.handled = true; // Mark this error as handled
        
        // Check for specific error types to provide more helpful messages
        if (error.message && error.message.includes('Failed to fetch')) {
            this.showNotification('warning', 'Connection Issue', 'Unable to connect to the server.');
        } else if (error.status === 404 || (error.message && error.message.includes('404'))) {
            this.showNotification('warning', 'API Not Found', 'The server API endpoint could not be found.');
        } else if (error.message && error.message.includes('Document not found')) {
            this.showNotification('warning', 'Document Not Found', 'The document may have been deleted or moved.');
        } else if (error.message && error.message.includes('NetworkError')) {
            this.showNotification('warning', 'Network Issue', 'Connection issue detected.');
        } else {
            this.showNotification('error', 'Processing Error', 'There was an issue processing your document.');
        }
        
        if (fallbackAction && typeof fallbackAction === 'function') {
            setTimeout(fallbackAction, 500);
        }
    }

    showLoading(message) {
        if (this.loadingOverlay) {
            const messageElement = this.loadingOverlay.querySelector('p');
            if (messageElement) {
                messageElement.textContent = message;
            }
            this.loadingOverlay.classList.remove('hidden');
        }
    }

    hideLoading() {
        if (this.loadingOverlay) {
            this.loadingOverlay.classList.add('hidden');
        }
    }

    showNotification(type, title, message) {
        // Check if we already have a notification with this exact title
        const existingNotifications = document.querySelectorAll('.notification');
        for (const notification of existingNotifications) {
            const notificationTitle = notification.querySelector('h4')?.textContent;
            if (notificationTitle === title) {
                console.log('Similar notification already exists, not showing duplicate:', title);
                return; // Don't show duplicate notifications
            }
        }
        
        // Max of 2 notifications at once - instead of blocking completely, replace oldest
        if (this.activeNotifications >= 2) {
            const notificationContainer = document.querySelector('.notification-container');
            if (notificationContainer && notificationContainer.firstChild) {
                notificationContainer.firstChild.remove();
                this.activeNotifications--;
            }
        }
        
        this.activeNotifications++;
        
        const notificationContainer = document.querySelector('.notification-container') || 
            (() => {
                const container = document.createElement('div');
                container.className = 'notification-container';
                document.body.appendChild(container);
                return container;
            })();
        
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <h4>${title}</h4>
                <p>${message}</p>
            </div>
            <button class="notification-close">&times;</button>
        `;
        
        notificationContainer.appendChild(notification);
        
        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.classList.add('fade-out');
            setTimeout(() => {
                notification.remove();
                this.activeNotifications--;
            }, 300);
        });
        
        // Auto-dismiss after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.classList.add('fade-out');
                setTimeout(() => {
                    notification.remove();
                    this.activeNotifications--;
                }, 300);
            }
        }, 5000);
    }

    getCurrentCredits() {
        if (this.userCredits) {
            const creditsText = this.userCredits.textContent || '0';
            const credits = parseInt(creditsText.replace(/\D/g, ''), 10) || 0;
            console.log(`Current credits: ${credits}`);
            return credits;
        }
        // Default to 0 instead of 1 to prevent scanning without credits
        return 0;
    }

    updateCreditsUI(newCredits) {
        if (this.userCredits) {
            this.userCredits.textContent = newCredits.toString();
            
            // Add visual feedback when credits change
            this.userCredits.classList.add('credits-updated');
            setTimeout(() => {
                this.userCredits.classList.remove('credits-updated');
            }, 1500);
            
            // Disable scan button if credits are zero
            if (this.scanBtn && newCredits <= 0) {
                this.scanBtn.classList.add('disabled');
                this.scanBtn.setAttribute('title', 'No credits remaining');
                // Actually disable the button to prevent clicks
                this.scanBtn.setAttribute('disabled', 'disabled');
            } else if (this.scanBtn) {
                this.scanBtn.classList.remove('disabled');
                this.scanBtn.removeAttribute('title');
                // Remove disabled attribute
                this.scanBtn.removeAttribute('disabled');
            }
        }
    }

    enhanceResultsWithFileContent(data, file) {
        const fileContent = this.getDocumentFromCache(`temp_${file.name}`);
        if (fileContent) {
            data.matches.forEach(match => {
                if (match.documentId === file.name || match.filename === file.name) {
                    match.content = fileContent.content;
                    match.previewContent = fileContent.content.substring(0, 200);
                }
            });
        }
    }

    enhanceMatchesWithContent(matches, filename, content) {
        // Look for matches of the current file and update them
        const exactMatches = matches.filter(m => 
            m.filename === filename || 
            m.documentName === filename || 
            m.similarity >= 99);
        
        if (exactMatches.length > 0) {
            exactMatches.forEach(match => {
                match.content = content;
                match.previewContent = content.substring(0, 200);
                match.isCurrentFile = true;
                match.similarity = 100; // Force to 100%
                match.commonWords = this.extractCommonWords(content);
            });
        } else {
            // Add the file as a current file match
            matches.unshift({
                documentId: `temp_${Date.now()}`,
                id: `temp_${Date.now()}`,
                documentName: filename,
                filename: filename,
                similarity: 100, // Force to 100%
                uploadDate: new Date().toLocaleString(),
                content: content,
                previewContent: content.substring(0, 200),
                commonWords: this.extractCommonWords(content),
                isCurrentFile: true
            });
        }
        
        // Fix all similarity scores in the matches
        matches.forEach(match => {
            if (match.similarity === undefined || match.similarity === null || isNaN(match.similarity)) {
                match.similarity = 0;
            } else {
                // Ensure it's a valid number with at most one decimal place
                match.similarity = parseFloat(parseFloat(match.similarity).toFixed(1));
                
                // Force values to be within 0-100 range
                match.similarity = Math.max(0, Math.min(100, match.similarity));
            }
        });
    }

    cacheDocumentContent(docId, content) {
        this.documentCache[docId] = content;
    }

    getDocumentFromCache(docId) {
        return this.documentCache[docId];
    }

    generateResultsHash(matches) {
        if (!matches || matches.length === 0) return 'no-matches';
        
        return matches.map(match => {
            // Create a simple hash using the most important properties
            return `${match.documentId || match.id || ''}:${match.similarity}`;
        }).join('|');
    }

    initializeModals() {
        // Ensure the credit request modal exists and is properly styled
        const creditModal = document.getElementById('credit-modal');
        if (creditModal) {
            // Fix z-index and positioning
            creditModal.style.zIndex = '1000';
            creditModal.style.position = 'fixed';
            
            // Ensure modal display style is set to flex when visible
            const oldDisplay = creditModal.style.display;
            if (oldDisplay !== 'none') {
                creditModal.style.display = 'flex';
                creditModal.style.alignItems = 'center';
                creditModal.style.justifyContent = 'center';
            }
            
            // Add close handlers if not already present
            const closeButtons = creditModal.querySelectorAll('.close-btn, .modal-close');
            closeButtons.forEach(btn => {
                if (!btn.hasAttribute('data-listener-attached')) {
                    btn.setAttribute('data-listener-attached', 'true');
                    btn.addEventListener('click', () => {
                        creditModal.classList.add('hidden');
                    });
                }
            });
        }
    }

    readFileContent(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => resolve(event.target.result);
            reader.onerror = (error) => reject(error);
            reader.readAsText(file);
        });
    }

    extractCommonWords(content, max = 10) {
        if (!content) return [];
        
        const words = content.toLowerCase()
            .replace(/[^\w\s]/g, '')
            .split(/\s+/)
            .filter(word => word.length > 2); // Skip short words
        
        // Get frequency of each word
        const wordFreq = {};
        words.forEach(word => {
            wordFreq[word] = (wordFreq[word] || 0) + 1;
        });
        
        // Sort by frequency and get top words
        return Object.keys(wordFreq)
            .sort((a, b) => wordFreq[b] - wordFreq[a])
            .slice(0, max);
    }

    // Add the displayScanResults method that was missing
    displayScanResults(data) {
        if (!data) {
            console.error('No scan results to display');
            return;
        }
        
        // Calculate a hash of the matches for comparison
        const matchesHash = this.generateResultsHash(data.matches);
        
        // If same results are already displayed, don't refresh
        if (this.lastResultsHash === matchesHash) {
            console.log('Same results already displayed, skipping refresh');
            return;
        }
        
        console.log('Displaying scan results:', data);
        
        // Process matches data
        let matches = data.matches || [];
        
        // Ensure we have a consistent array structure
        if (!Array.isArray(matches)) {
            matches = [];
        }
        
        // Add summary section - update to accurately count matches by type
        const exactMatches = matches.filter(m => m.similarity >= 99.5).length;
        const highMatches = matches.filter(m => m.similarity >= 75 && m.similarity < 99.5).length;
        const mediumMatches = matches.filter(m => m.similarity >= 40 && m.similarity < 75).length;
        const lowMatches = matches.filter(m => m.similarity < 40).length;
        
        // Store this data's hash as last displayed
        this.lastResultsHash = matchesHash;

        // Prevent flickering by ensuring the container exists and is ready
        if (!this.matchesList) {
            this.matchesList = document.getElementById('matches-list');
            if (!this.matchesList) {
                console.error('Matches list element not found! Cannot display results.');
                return;
            }
        }
        
        // Clear existing content properly with animation fade out
        this.matchesList.classList.add('fade-out');
        
        setTimeout(() => {
            this.matchesList.classList.remove('fade-out');
            this.matchesList.innerHTML = '';
            
            if (!data.matches || data.matches.length === 0) {
                this.matchesList.innerHTML = `
                    <div class="no-results">
                        <h3>No Similarities Found</h3>
                        <p>Your document appears to be unique! No significant matches were detected in our database.</p>
                    </div>
                `;
            } else {
                // Add summary section
                const summaryHtml = `
                    <div class="match-summary">
                        <div class="similarity-stats">
                            <div class="stat-item high">
                                <span class="count">${exactMatches}</span>
                                <span class="label">Exact Match</span>
                            </div>
                            <div class="stat-item high">
                                <span class="count">${highMatches}</span>
                                <span class="label">High Similarity</span>
                            </div>
                            <div class="stat-item medium">
                                <span class="count">${mediumMatches}</span>
                                <span class="label">Medium Similarity</span>
                            </div>
                            <div class="stat-item low">
                                <span class="count">${lowMatches}</span>
                                <span class="label">Low Similarity</span>
                            </div>
                        </div>
                    </div>
                `;
                
                this.matchesList.innerHTML = summaryHtml;
                
                // Add each match
                data.matches.forEach((match, index) => {
                    // Use correct similarity level
                    const similarityLevel = this.getSimilarityLevel(match.similarity);
                    
                    const matchElement = document.createElement('div');
                    matchElement.className = `match-item ${similarityLevel}-similarity`;
                    
                    // Mark the current file if applicable
                    if (match.isCurrentFile) {
                        matchElement.classList.add('current-file');
                    }
                    
                    const documentId = match.documentId || match.id || '';
                    
                    // Add exact match badge if applicable
                    const exactBadge = match.similarity >= 99.5 ? 
                        '<span class="exact-badge">EXACT MATCH</span>' : '';
                    
                    // Always show at least one decimal place for accuracy
                    const formattedSimilarity = Number(match.similarity).toFixed(1);
                    
                    let commonWordsHtml = '';
                    if (match.commonWords && match.commonWords.length > 0) {
                        commonWordsHtml = `
                            <div class="common-words">
                                <h5>Common Words</h5>
                                <div class="word-tags">
                                    ${match.commonWords.map(word => `<span class="word-tag">${word}</span>`).join('')}
                                </div>
                            </div>
                        `;
                    }
                    
                    // Add a current file indicator if this is the uploaded file
                    const currentFileIndicator = match.isCurrentFile ? 
                        '<span class="current-file-badge">CURRENT FILE</span>' : '';
                    
                    // Handle the preview content - always ensure we have something to show
                    const previewContent = match.previewContent || 
                        (match.content ? match.content.substring(0, 200) : 'Content preview not available');
                    
                    matchElement.innerHTML = `
                        <div class="match-header">
                            <h4>${match.documentName || match.filename || 'Document'} ${exactBadge} ${currentFileIndicator}</h4>
                            <span class="similarity-badge">${formattedSimilarity}% Match</span>
                        </div>
                        <div class="similarity-bar">
                            <div class="similarity-progress" style="width: ${match.similarity}%"></div>
                        </div>
                        ${commonWordsHtml}
                        <div class="content-preview collapsed">
                            ${this.formatPreviewContent(previewContent)}
                        </div>
                        <div class="match-actions">
                            <button class="view-content-btn">View More</button>
                            <button class="view-full-btn" data-doc-id="${documentId}">View Full Document</button>
                        </div>
                    `;
                    
                    this.matchesList.appendChild(matchElement);
                    
                    // Setup view content toggle
                    const viewContentBtn = matchElement.querySelector('.view-content-btn');
                    const contentPreview = matchElement.querySelector('.content-preview');
                    if (viewContentBtn && contentPreview) {
                        viewContentBtn.addEventListener('click', () => {
                            if (contentPreview.classList.contains('collapsed')) {
                                contentPreview.classList.remove('collapsed');
                                contentPreview.classList.add('expanded');
                                viewContentBtn.textContent = 'Show Less';
                            } else {
                                contentPreview.classList.remove('expanded');
                                contentPreview.classList.add('collapsed');
                                viewContentBtn.textContent = 'View More';
                            }
                        });
                    }

                    // Add View Full Document functionality
                    const viewFullBtn = matchElement.querySelector('.view-full-btn');
                    if (viewFullBtn) {
                        viewFullBtn.addEventListener('click', () => {
                            const docId = viewFullBtn.getAttribute('data-doc-id');
                            if (docId) {
                                console.log(`Viewing document with ID: ${docId}`);
                                try {
                                    if (window.dashboardController && typeof window.dashboardController.viewFullDocument === 'function') {
                                        window.dashboardController.viewFullDocument(docId);
                                    } else {
                                        console.error('Dashboard controller or viewFullDocument method not available');
                                        this.showNotification('error', 'Error', 'Document viewer not available');
                                    }
                                } catch (err) {
                                    console.error('Error while trying to view document:', err);
                                    this.showNotification('error', 'Error', 'Could not open document viewer');
                                }
                            } else {
                                this.showNotification('error', 'Error', 'Document ID not available');
                            }
                        });
                    }
                });
            }
            
            // Show results container with smooth animation
            if (this.resultsContainer) {
                this.resultsContainer.style.display = 'block';
                this.resultsContainer.style.opacity = '0';
                
                setTimeout(() => {
                    this.resultsContainer.style.transition = 'opacity 0.3s ease-in';
                    this.resultsContainer.style.opacity = '1';
                    
                    setTimeout(() => {
                        this.resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 300);
                }, 50);
            }
        }, 300);
    }
    
    // Add the getSimilarityLevel helper function
    getSimilarityLevel(percentage) {
        // Use strict comparison for exact matches (100%)
        if (percentage >= 99.5) return 'exact'; // Allow for minor calculation differences
        if (percentage >= 75) return 'high';
        if (percentage >= 40) return 'medium';
        return 'low';
    }

    // Add method to format preview content with proper line breaks
    formatPreviewContent(content) {
        if (!content) return 'Content preview not available';
        
        // Replace newlines with <br> tags for proper HTML display
        return content
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\n/g, '<br>')
            .replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;');
    }
}

// Ensure we query for elements after the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    // Add CSS for smooth transitions
    const style = document.createElement('style');
    style.textContent = `
        .fade-out {
            opacity: 0;
            transition: opacity 0.3s ease-out;
        }
        
        .cloud-icon {
            font-size: 2.5rem !important; /* Increase cloud icon size */
            margin-bottom: 10px;
        }
        
        .scan-results-container {
            transition: opacity 0.3s ease-in;
        }
        
        .matches-list {
            transition: opacity 0.3s ease-in;
        }
        
        /* Add animation for credit updates */
        .credits-updated {
            animation: pulse 1.5s ease-in-out;
        }
        
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; color: #ff9800; }
            100% { opacity: 1; }
        }
        
        /* Styling for disabled scan button */
        .scan-btn.disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }

        /* Fix for credit modal */
        #credit-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.6);
            z-index: 1000;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        #credit-modal.hidden {
            display: none;
        }
        
        .modal-content {
            background-color: rgba(48, 8, 55, 0.95);
            border-radius: 10px;
            padding: 25px;
            max-width: 500px;
            width: 90%;
            box-shadow: 0 5px 20px rgba(0,0,0,0.3);
            position: relative;
            color: white;
            border: 1px solid rgba(255,255,255,0.1);
        }
        
        .close-btn {
            position: absolute;
            top: 10px;
            right: 10px;
            font-size: 24px;
            cursor: pointer;
            color: white;
            background: none;
            border: none;
            outline: none;
        }
        
        .current-file {
            border-left-color: #4CAF50;
            background-color: rgba(76, 175, 80, 0.1);
        }
        
        .current-file-badge {
            background-color: #4CAF50;
            color: white;
            padding: 3px 8px;
            border-radius: 20px;
            font-size: 0.7rem;
            font-weight: bold;
            margin-left: 10px;
            vertical-align: middle;
        }
        
        .current-file .match-header {
            background-color: rgba(76, 175, 80, 0.2);
        }
        
        .current-file .similarity-progress {
            background: linear-gradient(90deg, #4CAF50, #81C784);
        }
    `;
    document.head.appendChild(style);
    
    // Short delay to ensure all DOM elements are properly initialized
    setTimeout(() => {
        window.scanHandler = new ScanHandler();
        console.log('ScanHandler initialized');
        
        // Check credits on load and disable button if needed
        const scanHandler = window.scanHandler;
        if (scanHandler) {
            const credits = scanHandler.getCurrentCredits();
            if (credits <= 0) {
                const scanBtn = document.getElementById('upload-scan-btn');
                if (scanBtn) {
                    scanBtn.classList.add('disabled');
                    scanBtn.setAttribute('disabled', 'disabled');
                    scanBtn.setAttribute('title', 'No credits remaining');
                }
            }
        }
        
        // Add debug controls for developers to toggle mock data
        if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
            console.log('Developer tools available:');
            console.log('- Check credits: window.scanHandler.getCurrentCredits()');
        }
        
        // Increase cloud icon size if it exists
        const cloudIcons = document.querySelectorAll('.cloud-icon');
        cloudIcons.forEach(icon => {
            icon.style.fontSize = '2.5rem';
            icon.style.marginBottom = '10px';
        });
    }, 100);
});
