class DashboardController {
    constructor() {
        this.ws = null;
        this.selectedFile = null;
        
        // Add ApiService fallback if not defined
        if (typeof ApiService === 'undefined') {
            console.warn('ApiService not defined, creating mock service');
            window.ApiService = {
                isAuthenticated() { return true; },
                setupWebSocket() { return null; },
                fetchWithAuth(url) { 
                    console.log('Mock API call to:', url);
                    return Promise.resolve({}); 
                },
                logout() { 
                    console.log('Mock logout');
                    window.location.href = '/login'; // Changed from '/login.html' to '/login'
                }
            };
        }
        
        // Initialize
        this.init();
        this.initializeCreditRequestButton();
        
        // Add ability to open diagnostics
        this.checkApiStatus();
    }
    
    async init() {
        // Check authentication
        if (!ApiService.isAuthenticated()) {
            window.location.href = '/login'; // Changed from '/login.html' to '/login'
            return;
        }

        // Set username from localStorage
        document.getElementById('username-display').textContent = localStorage.getItem('username') || 'User';
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Load initial data with error handling
        try {
            await this.loadUserCredits();
        } catch (error) {
            console.error('Failed to load user credits:', error);
            // Set default credits from localStorage as fallback
            const creditsElement = document.getElementById('credits-display');
            if (creditsElement) {
                creditsElement.textContent = localStorage.getItem('userCredits') || '0';
            }
        }
        
        try {
            await this.loadRecentDocuments();
        } catch (error) {
            console.error('Failed to load recent documents:', error);
            // Show empty state message
            const docsContainer = document.getElementById('recent-docs');
            if (docsContainer) {
                docsContainer.innerHTML = '<tr><td colspan="3" class="empty-state">No documents found or unable to connect to server</td></tr>';
            }
        }
        
        // Setup WebSocket for real-time updates
        this.ws = ApiService.setupWebSocket();
    }
    
    setupEventListeners() {
        // Drag and drop functionality
        const dropArea = document.getElementById('drop-area');
        const fileInput = document.getElementById('document-file');
        const browseBtn = document.getElementById('browse-btn');
        const uploadScanBtn = document.getElementById('upload-scan-btn');
        const cancelUploadBtn = document.getElementById('cancel-upload-btn');
        const filePreview = document.getElementById('file-preview');
        
        // Prevent default behaviors for drag events
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });
        
        // Highlight drop area when dragging over
        ['dragenter', 'dragover'].forEach(eventName => {
            dropArea.addEventListener(eventName, () => {
                dropArea.classList.add('drag-over');
            });
        });
        
        // Remove highlight when dragging leaves
        ['dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, () => {
                dropArea.classList.remove('drag-over');
            });
        });
        
        // Handle file drop
        dropArea.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            if (files.length) {
                this.handleFileSelection(files[0]);
            }
        });
        
        // Handle file input change
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length) {
                this.handleFileSelection(e.target.files[0]);
            }
        });
        
        // Browse button click
        browseBtn.addEventListener('click', () => {
            fileInput.click();
        });
        
        // Upload & scan button click
        uploadScanBtn.addEventListener('click', () => {
            if (this.selectedFile) {
                this.uploadAndScanFile(this.selectedFile);
            }
        });
        
        // Cancel button click
        cancelUploadBtn.addEventListener('click', () => {
            this.resetFileSelection();
        });
        
        // Credit request modal
        document.getElementById('request-credits-btn').addEventListener('click', () => {
            document.getElementById('credit-modal').classList.remove('hidden');
        });
        
        // Close modals
        document.querySelectorAll('.close-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.target.closest('.modal').classList.add('hidden');
            });
        });
        
        // Logout
        document.getElementById('logout-btn').addEventListener('click', () => {
            ApiService.logout();
        });
        
        // Listen for credit updates
        document.addEventListener('creditUpdate', (e) => {
            document.getElementById('credits-display').textContent = e.detail.credits;
        });
    }
    
    handleFileSelection(file) {
        const filePreview = document.getElementById('file-preview');
        const dropZonePrompt = document.querySelector('.drop-zone-prompt');
        const selectedFilename = document.getElementById('selected-filename');
        
        // Store the selected file
        this.selectedFile = file;
        
        // Show file name
        selectedFilename.textContent = file.name;
        
        // Show file preview and hide prompt
        dropZonePrompt.classList.add('hidden');
        filePreview.classList.remove('hidden');
    }
    
    resetFileSelection() {
        const filePreview = document.getElementById('file-preview');
        const dropZonePrompt = document.querySelector('.drop-zone-prompt');
        const fileInput = document.getElementById('document-file');
        
        // Clear file input
        fileInput.value = '';
        this.selectedFile = null;
        
        // Show prompt and hide file preview
        filePreview.classList.add('hidden');
        dropZonePrompt.classList.remove('hidden');
    }
    
    async loadUserCredits() {
        try {
            // Try multiple endpoint paths for credits - remove /api/ prefix
            const endpoints = [
                'credits/balance',
                'user/credits',
                'credits'
            ];
            
            // Use the tryMultipleEndpoints method to attempt each endpoint
            const data = await ApiService.tryMultipleEndpoints(endpoints);
            
            if (data && data.credits !== undefined) {
                document.getElementById('credits-display').textContent = data.credits;
                localStorage.setItem('userCredits', data.credits);
            } else {
                throw new Error('Invalid credit data returned');
            }
        } catch (error) {
            console.error('Failed to load credits:', error);
            
            // Fallback to localStorage
            const cachedCredits = localStorage.getItem('userCredits');
            if (cachedCredits) {
                document.getElementById('credits-display').textContent = cachedCredits;
            }
            
            this.showNotification('error', 'Failed to load credit balance');
        }
    }
    
    async loadRecentDocuments() {
        try {
            // Try multiple endpoint paths for documents - remove /api/ prefix
            const endpoints = [
                'documents/recent',
                'documents'
            ];
            
            // Use the tryMultipleEndpoints method to attempt each endpoint
            const documents = await ApiService.tryMultipleEndpoints(endpoints);
            const docsContainer = document.getElementById('recent-docs');
            
            if (!Array.isArray(documents) || documents.length === 0) {
                docsContainer.innerHTML = '<tr><td colspan="3" class="empty-state">No documents found</td></tr>';
                return;
            }
            
            docsContainer.innerHTML = documents.map(doc => `
                <tr>
                    <td>${doc.filename || 'Untitled Document'}</td>
                    <td>${new Date(doc.uploadDate).toLocaleString()}</td>
                    <td>
                        <button class="view-btn" onclick="dashboardController.viewMatches('${doc.id || doc.documentId}')">View Matches</button>
                    </td>
                </tr>
            `).join('');
        } catch (error) {
            console.error('Failed to load documents:', error);
            
            const docsContainer = document.getElementById('recent-docs');
            docsContainer.innerHTML = '<tr><td colspan="3" class="empty-state">Unable to load documents - please try again later</td></tr>';
            
            this.showNotification('error', 'Failed to load recent documents');
        }
    }
    
    async uploadAndScanFile(file) {
        // Show loading overlay
        document.getElementById('loading-overlay').classList.remove('hidden');
        document.getElementById('loading-overlay').querySelector('p').textContent = "Processing document...";
        
        const reader = new FileReader();
        
        reader.onload = async (event) => {
            try {
                const content = event.target.result;
                const fileType = file.type;
                
                // Calculate a simple hash of content to prevent re-upload
                const contentHash = await this.calculateContentHash(content);
                
                // Check local storage for recently uploaded hashes
                const recentUploads = JSON.parse(localStorage.getItem('recentUploads') || '{}');
                if (recentUploads[contentHash]) {
                    console.log('File was recently uploaded, showing existing matches');
                    document.getElementById('loading-overlay').classList.add('hidden');
                    this.resetFileSelection();
                    this.showNotification('info', 'Already Scanned', 'This document was recently scanned. Showing existing matches.');
                    
                    try {
                        this.viewMatches(recentUploads[contentHash]);
                    } catch (viewError) {
                        console.error('Error viewing matches:', viewError);
                        
                        // Fallback to mock data if the scan handler is available
                        if (window.scanHandler) {
                            window.scanHandler.displayScanResults(
                                window.scanHandler.getMockResults(file.name)
                            );
                        }
                    }
                    return; // Important: exit early to avoid showing success notification
                }

                // Try several API endpoints - remove slashes that ApiService will handle
                const endpoints = [
                    'documents/upload',
                    'upload/documents', 
                    'upload'
                ];
                
                let uploadSuccessful = false;
                let lastError = null;
                let response = null;
                
                // Try each endpoint
                for (const endpoint of endpoints) {
                    try {
                        response = await ApiService.fetchWithAuth(endpoint, {
                            method: 'POST',
                            body: JSON.stringify({
                                filename: file.name,
                                content,
                                fileType
                            })
                        });
                        
                        uploadSuccessful = true;
                        break; // If successful, exit the loop
                    } catch (error) {
                        lastError = error;
                        console.warn(`Upload to ${endpoint} failed:`, error);
                    }
                }
                
                // If all uploads failed
                if (!uploadSuccessful) {
                    // Store content hash with a temporary ID so we don't rescan
                    const tempId = `temp_${Date.now()}`;
                    recentUploads[contentHash] = tempId;
                    localStorage.setItem('recentUploads', JSON.stringify(recentUploads));
                    
                    throw lastError || new Error('Failed to upload document to any endpoint');
                }
                
                // Hide loading overlay
                document.getElementById('loading-overlay').classList.add('hidden');
                
                // Reset file selection
                this.resetFileSelection();
                
                // Check if the file was a duplicate
                if (response.isDuplicate) {
                    console.log(`Duplicate file detected (ID: ${response.documentId})`);
                    
                    // Store in recent uploads cache
                    recentUploads[contentHash] = response.documentId;
                    localStorage.setItem('recentUploads', JSON.stringify(recentUploads));
                    
                    this.showNotification('info', 'Already in Database', 'This document already exists in the system. Showing existing matches.');
                    
                    // Allow a small delay before showing matches
                    setTimeout(() => {
                        this.viewMatches(response.documentId);
                    }, 500);
                    
                    return; // Important: exit early to avoid showing success notification
                }
                
                // For new documents, add to recent uploads cache
                if (response.documentId) {
                    recentUploads[contentHash] = response.documentId;
                    localStorage.setItem('recentUploads', JSON.stringify(recentUploads));
                }
                
                // Refresh document list only for new documents
                await this.loadRecentDocuments();
                
                // Handle normal upload completion
                if (response.creditsRemaining !== undefined) {
                    document.getElementById('credits-display').textContent = response.creditsRemaining;
                }
                this.showNotification('success', 'Upload Complete', 'Document uploaded and analyzed successfully!');
                
                // Show matches for the newly uploaded document
                if (response.documentId) {
                    setTimeout(() => {
                        console.log(`Viewing matches for document ID: ${response.documentId}`);
                        this.viewMatches(response.documentId);
                    }, 500);
                }
                
            } catch (error) {
                // Hide loading overlay
                document.getElementById('loading-overlay').classList.add('hidden');
                
                if (error.message && error.message.includes('Insufficient credits')) {
                    this.showNotification('error', 'Needs Credits', 'You need more credits to analyze documents. Please request additional credits.');
                } else {
                    console.error('Upload error:', error);
                    this.showNotification('error', 'Upload Failed', 'Could not process document: ' + (error.message || 'server connection issue'));
                }
            }
        };
        
        reader.readAsText(file);
    }

    // Add a new helper function to calculate content hash
    async calculateContentHash(content) {
        // This is a simple hash function for demo purposes
        // In production, you would use a proper crypto library
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            hash = ((hash << 5) - hash) + content.charCodeAt(i);
            hash |= 0; // Convert to 32bit integer
        }
        return hash.toString();
    }
    
    // Update the viewMatches function to use the new scan-handler approach
    async viewMatches(docId) {
        try {
            // Show loading overlay
            document.getElementById('loading-overlay').classList.remove('hidden');
            document.getElementById('loading-overlay').querySelector('p').textContent = "Finding similar documents...";
            
            // Try getting the original document details
            let originalDoc = null;
            try {
                // Try multiple endpoint formats - remove slashes that ApiService will handle
                const docEndpoints = [
                    `documents/${docId}`,
                    `document/${docId}`
                ];
                
                originalDoc = await ApiService.tryMultipleEndpoints(docEndpoints);
                console.log(`Requesting matches for document: ${originalDoc.filename}`);
                
                // Store the document content in scanHandler cache for proper display
                if (window.scanHandler && originalDoc.content) {
                    window.scanHandler.cacheDocumentContent(docId, {
                        filename: originalDoc.filename,
                        content: originalDoc.content
                    });
                }
            } catch (docError) {
                console.warn('Could not fetch original document:', docError);
                // Create a minimal document object with the ID
                originalDoc = { id: docId, filename: 'Unknown Document' };
            }
            
            // Try multiple endpoint patterns for matches - remove slashes that ApiService will handle
            const matchEndpoints = [
                `scan/matches/${docId}`,
                `documents/matches/${docId}`,
                `matches/${docId}`
            ];
            
            const response = await ApiService.tryMultipleEndpoints(matchEndpoints);
            
            // Hide loading overlay
            document.getElementById('loading-overlay').classList.add('hidden');
            
            // Use the scan handler to display results directly in the page
            if (window.scanHandler) {
                // Add the original document content to the matches if available
                if (originalDoc && originalDoc.content && response.matches) {
                    // Fix empty or null matches array
                    if (!Array.isArray(response.matches)) {
                        response.matches = [];
                    }
                    
                    // Look for exact match or create one
                    const exactMatch = response.matches.find(m => 
                        m.documentId === docId || m.id === docId || m.similarity >= 99);
                    
                    if (exactMatch) {
                        // Update with actual content
                        exactMatch.content = originalDoc.content;
                        exactMatch.previewContent = originalDoc.content.substring(0, 200);
                        exactMatch.isCurrentFile = true;
                        exactMatch.similarity = 100; // Force to 100%
                        
                        // Extract common words if missing
                        if (!exactMatch.commonWords && window.scanHandler.extractCommonWords) {
                            exactMatch.commonWords = window.scanHandler.extractCommonWords(originalDoc.content);
                        }
                    } else {
                        // Add the original document as a match
                        response.matches.unshift({
                            documentId: docId,
                            id: docId,
                            documentName: originalDoc.filename,
                            filename: originalDoc.filename,
                            similarity: 100, // Force to 100%
                            uploadDate: originalDoc.uploadDate || new Date().toLocaleString(),
                            content: originalDoc.content,
                            previewContent: originalDoc.content.substring(0, 200),
                            commonWords: window.scanHandler.extractCommonWords ? 
                                window.scanHandler.extractCommonWords(originalDoc.content) : [],
                            isCurrentFile: true
                        });
                    }
                }
                
                // Fix similarity scores before displaying
                if (response.matches && Array.isArray(response.matches)) {
                    response.matches.forEach(match => {
                        // Fix any invalid similarity scores
                        if (match.similarity === undefined || match.similarity === null || isNaN(match.similarity)) {
                            match.similarity = 0;
                        } else {
                            // Ensure it's a valid number with one decimal place
                            match.similarity = parseFloat(parseFloat(match.similarity).toFixed(1));
                            
                            // Force values to be within 0-100 range
                            match.similarity = Math.max(0, Math.min(100, match.similarity));
                        }
                    });
                }
                
                window.scanHandler.displayScanResults(response);
            } else {
                console.error('Scan handler not available');
                this.showNotification('error', 'Failed to display scan results');
            }
            
        } catch (error) {
            console.error('Error viewing matches:', error);
            document.getElementById('loading-overlay').classList.add('hidden');
            
            // Show error notification - no fallback to mock data
            this.showNotification('error', 'View Failed', 'Failed to view document matches');
        }
    }
    
    // Format content preview with proper indentation and highlighting
    formatContentPreview(content) {
        if (!content) return 'No content available';
        
        // Get a suitable preview length (first 150 characters)
        const preview = content.substring(0, 150);
        
        // Format the preview with syntax highlighting
        const formatted = preview
            .replace(/\n/g, '<br>')
            .replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;')
            .replace(/\b(function|return|if|else|for|while|var|let|const)\b/g, '<span class="keyword">$1</span>')
            .replace(/\b(true|false|null|undefined)\b/g, '<span class="literal">$1</span>')
            .replace(/(".*?"|'.*?')/g, '<span class="string">$1</span>')
            .replace(/\b([0-9]+)\b/g, '<span class="number">$1</span>');
        
        return formatted + (content.length > 150 ? '...' : '');
    }
    
    // Toggle between collapsed and expanded view of content
    toggleContentView(button) {
        const contentDiv = button.closest('.match-item').querySelector('.content-preview');
        if (contentDiv.classList.contains('collapsed')) {
            contentDiv.classList.remove('collapsed');
            contentDiv.classList.add('expanded');
            button.textContent = 'Show Less';
        } else {
            contentDiv.classList.remove('expanded');
            contentDiv.classList.add('collapsed');
            button.textContent = 'Show More';
        }
    }
    
    // View the full document in a modal
    async viewFullDocument(docId) {
        try {
            console.log('Viewing full document with ID:', docId);
            
            // Show loading overlay
            document.getElementById('loading-overlay').classList.remove('hidden');
            document.getElementById('loading-overlay').querySelector('p').textContent = "Loading document...";
            
            // Check if scanHandler has this document cached
            let doc = null;
            if (window.scanHandler && window.scanHandler.getDocumentFromCache) {
                doc = window.scanHandler.getDocumentFromCache(docId);
            }
            
            // If not in cache, try to fetch from API
            if (!doc || !doc.content) {
                try {
                    // Try multiple endpoint formats
                    const docEndpoints = [
                        `/api/documents/${docId}`,
                        `/documents/${docId}`
                    ];
                    
                    doc = await ApiService.tryMultipleEndpoints(docEndpoints);
                    
                    // Cache the result for future use
                    if (window.scanHandler && window.scanHandler.cacheDocumentContent) {
                        window.scanHandler.cacheDocumentContent(docId, doc);
                    }
                } catch (apiError) {
                    console.warn('API error:', apiError);
                    throw new Error('Could not load document content');
                }
            }
            
            // Hide loading overlay
            document.getElementById('loading-overlay').classList.add('hidden');
            
            if (!doc || !doc.content) {
                throw new Error('Document content not available');
            }
            
            // Remove any existing modals to prevent stacking
            const existingModals = document.querySelectorAll('.full-document-modal');
            existingModals.forEach(modal => modal.remove());
            
            // Create a full document viewer modal
            const viewerModal = document.createElement('div');
            viewerModal.className = 'full-document-modal';
            viewerModal.innerHTML = `
                <div class="full-document-content">
                    <div class="full-document-header">
                        <h3>${doc.filename || 'Document Content'}</h3>
                        <button class="close-full-btn">&times;</button>
                    </div>
                    <div class="full-document-body">
                        <pre>${doc.content || 'No content available'}</pre>
                    </div>
                </div>
            `;
            
            // Add close functionality
            viewerModal.querySelector('.close-full-btn').addEventListener('click', () => {
                viewerModal.remove();
            });
            
            // Add to body
            document.body.appendChild(viewerModal);
            
        } catch (error) {
            // Hide loading overlay
            document.getElementById('loading-overlay').classList.add('hidden');
            
            this.showNotification('error', 'Failed to load document: ' + error.message);
        }
    }
    
    highlightMatchedContent(content) {
        if (!content) return '';
        
        // Get the first ~100 characters for preview
        const preview = content.substring(0, 100);
        
        // Find potentially important parts (capitalized words, numbers, etc.)
        const highlighted = preview.replace(/\b([A-Z][a-z]+|[0-9]+%?)\b/g, '<span class="highlight">$1</span>');
        
        return highlighted + (content.length > 100 ? '...' : '');
    }
    
    calculateSimilarity(content) {
        // Simple placeholder for similarity calculation
        return Math.floor(Math.random() * 30) + 70; // Random value between 70-100%
    }
    
    showNotification(type, title, message) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `${type}-notification notification`;
        notification.innerHTML = `<strong>${title}</strong>: ${message}`;
        
        // Append to body
        document.body.appendChild(notification);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 3000);
    }

    /**
     * Initialize credit display and listeners
     */
    initializeCredits() {
        // Check credits on page load
        this.checkUserCredits();
        
        // Set up periodic credit check (every 5 minutes)
        setInterval(() => this.checkUserCredits(), 300000);
    }
    
    /**
     * Check user credits from server and update UI
     */
    checkUserCredits() {
        // Try main endpoint first
        fetch('/api/credits/balance', {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            credentials: 'include'
        })
        .then(response => {
            if (!response.ok) throw new Error('Failed to fetch credits');
            return response.json();
        })
        .then(data => {
            if (data.credits !== undefined) {
                this.updateCreditsUI(data.credits);
                localStorage.setItem('userCredits', data.credits);
            }
        })
        .catch(err => {
            console.error('Error checking credits from main endpoint:', err);
            
            // Try fallback endpoint
            fetch('/api/user/credits', {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                credentials: 'include'
            })
            .then(response => {
                if (!response.ok) throw new Error('Failed to fetch credits from fallback');
                return response.json();
            })
            .then(data => {
                if (data.credits !== undefined) {
                    this.updateCreditsUI(data.credits);
                    localStorage.setItem('userCredits', data.credits);
                }
            })
            .catch(secondErr => {
                console.error('Error checking credits from fallback endpoint:', secondErr);
                
                // As last resort, use the cached credits from localStorage
                const cachedCredits = localStorage.getItem('userCredits');
                if (cachedCredits) {
                    this.updateCreditsUI(parseInt(cachedCredits, 10));
                }
            });
        });
    }
    
    /**
     * Update credits display in UI
     */
    updateCreditsUI(credits) {
        const creditsElement = document.getElementById('user-credits');
        if (creditsElement) {
            creditsElement.textContent = credits.toString();
            
            // Disable scan button if no credits
            const scanBtn = document.getElementById('upload-scan-btn');
            if (scanBtn) {
                if (credits <= 0) {
                    scanBtn.classList.add('disabled');
                    scanBtn.setAttribute('disabled', 'disabled');
                    scanBtn.setAttribute('title', 'No credits remaining');
                } else {
                    scanBtn.classList.remove('disabled');
                    scanBtn.removeAttribute('disabled');
                    scanBtn.removeAttribute('title');
                }
            }
        }
    }

    initializeCreditRequestButton() {
        const requestBtn = document.getElementById('request-credits-btn');
        if (requestBtn) {
            // Make sure the button opens the modal properly
            requestBtn.addEventListener('click', () => {
                const creditModal = document.getElementById('credit-modal');
                if (creditModal) {
                    creditModal.classList.remove('hidden');
                    creditModal.style.display = 'flex';
                } else {
                    console.error('Credit modal not found!');
                }
            });
        }
    }
    
    /**
     * Check API connection status and show diagnostics link if needed
     */
    checkApiStatus() {
        // Check if there are persistent API errors
        const apiErrorCount = parseInt(localStorage.getItem('apiErrorCount') || '0');
        
        if (apiErrorCount > 2) {
            // Show diagnostics link
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

// Call the function when the document is loaded
document.addEventListener('DOMContentLoaded', () => {
    // If we already have a dashboardController instance, don't create another one
    if (!window.dashboardController) {
        console.log('Creating dashboard controller');
        
        // File input handling
        const browseBtn = document.getElementById('browse-btn');
        const fileInput = document.getElementById('document-file');
        const dropZone = document.getElementById('drop-area');
        const filePreview = document.getElementById('file-preview');
        const dropZonePrompt = document.querySelector('.drop-zone-prompt');
        const selectedFilename = document.getElementById('selected-filename');
        const cancelBtn = document.getElementById('cancel-upload-btn');
        
        if (browseBtn && fileInput) {
            browseBtn.addEventListener('click', () => {
                fileInput.click();
            });
            
            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    const file = e.target.files[0];
                    if (dropZonePrompt) dropZonePrompt.classList.add('hidden');
                    if (filePreview) filePreview.classList.remove('hidden');
                    if (selectedFilename) selectedFilename.textContent = file.name;
                }
            });
        }
        
        // Drag and drop handling
        if (dropZone) {
            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.classList.add('drag-over');
            });
            
            dropZone.addEventListener('dragleave', () => {
                dropZone.classList.remove('drag-over');
            });
            
            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.classList.remove('drag-over');
                
                if (e.dataTransfer.files.length > 0) {
                    const file = e.dataTransfer.files[0];
                    if (fileInput) fileInput.files = e.dataTransfer.files;
                    if (dropZonePrompt) dropZonePrompt.classList.add('hidden');
                    if (filePreview) filePreview.classList.remove('hidden');
                    if (selectedFilename) selectedFilename.textContent = file.name;
                }
            });
        }
        
        // Cancel button handling
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                if (fileInput) fileInput.value = '';
                if (dropZonePrompt) dropZonePrompt.classList.remove('hidden');
                if (filePreview) filePreview.classList.add('hidden');
            });
        }
        
        // Initialize credits
        const creditsDisplay = document.getElementById('credits-display');
        if (creditsDisplay) {
            const credits = parseInt(localStorage.getItem('userCredits') || '50', 10);
            creditsDisplay.textContent = credits.toString();
            
            // Disable scan button if no credits
            const scanBtn = document.getElementById('upload-scan-btn');
            if (scanBtn && credits <= 0) {
                scanBtn.classList.add('disabled');
                scanBtn.setAttribute('disabled', 'disabled');
                scanBtn.setAttribute('title', 'No credits remaining');
            }
        }
        
        // Initialize dashboard controller - ONLY ONCE
        window.dashboardController = new DashboardController();
    } else {
        console.log('Dashboard controller already exists, not creating another instance');
    }
});
