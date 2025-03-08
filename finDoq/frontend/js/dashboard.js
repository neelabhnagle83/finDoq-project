class DashboardController {
    constructor() {
        this.uploadQueue = [];
        this.processingFile = false;
        this.credits = 0;
        this.ws = null;
        this.selectedFile = null;
        this.init().catch(console.error);  // Properly handle init errors
        this.connectWebSocket();
        this.setupButtons();
    }

    async init() {
        try {
            // Check authentication first
            const token = localStorage.getItem('token');
            if (!token) {
                window.location.href = 'login'; // Remove .html extension
                return;
            }
            
            this.resetDialogs(); // Clear any stuck dialogs
            await this.loadUserCredits(); // Load credits first before anything else
            this.setupDragDrop();
            this.setupEventListeners(); // Add this line
            this.setupCreditSystem();
            this.setupLogout();
            await this.loadRecentFiles();
        } catch (error) {
            console.error('Initialization error:', error);
            window.location.href = 'login'; // Remove .html extension
        }
    }

    // Innovative drag and drop with preview
    setupDragDrop() {
        const dropZone = document.querySelector('.upload-box');
        const browseBtn = document.querySelector('.browse-btn');
        const fileInput = document.getElementById('fileInput');
        const scanBtn = document.querySelector('.scan-btn');

        // Initially disable scan button
        scanBtn.disabled = true;
        scanBtn.style.opacity = '0.5';
        
        this.selectedFile = null;

        browseBtn.addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFileSelection(e.target.files[0]);
            }
        });

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
            
            const file = e.dataTransfer.files[0];
            if (file) {
                this.handleFileSelection(file);
            }
        });

        // Connect scan button
        scanBtn.addEventListener('click', () => {
            if (this.selectedFile) {
                this.confirmAndScanFile();
            }
        });
    }

    setupButtons() {
        const uploadBtn = document.querySelector('.upload-btn');
        const scanBtn = document.querySelector('.scan-btn');

        if (uploadBtn) {
            uploadBtn.addEventListener('click', () => {
                if (!this.selectedFile) {
                    this.showError('Please select a file first');
                    return;
                }
                this.uploadOnly();
            });
        }

        if (scanBtn) {
            scanBtn.addEventListener('click', async () => {
                if (!this.selectedFile) {
                    this.showError('Please select a file first');
                    return;
                }
                this.confirmAndScanFile();
            });
        }
    }

    async handleFileSelection(file) {
        // Validate file type
        if (!file.name.endsWith('.txt')) {
            this.showError('Please upload a text file (.txt)');
            return;
        }

        // Validate file size (5MB max)
        if (file.size > 5 * 1024 * 1024) {
            this.showError('File size should be less than 5MB');
            return;
        }

        this.selectedFile = file;
        this.updateFilePreview();
        
        // Show scan actions
        const scanActions = document.querySelector('.scan-actions');
        if (scanActions) {
            scanActions.style.display = 'flex';
        }

        // Enable scan button
        const scanBtn = document.querySelector('.scan-btn');
        if (scanBtn) {
            scanBtn.disabled = false;
            scanBtn.style.opacity = '1';
        }

        // Hide previous results if any
        document.getElementById('resultsContainer').style.display = 'none';
    }

    async checkDuplicateFile(file) {
        try {
            const content = await file.text();
            const response = await fetch('/api/documents/check-duplicate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ 
                    filename: file.name,
                    content: content 
                })
            });
            
            if (!response.ok) throw new Error('Failed to check file');
            
            const result = await response.json();
            if (result.isDuplicate) {
                // Show similarities for existing file
                await this.showExistingSimilarities(file);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error checking duplicate:', error);
            return false;
        }
    }

    async showExistingSimilarities(file) {
        try {
            const content = await file.text();
            const response = await fetch('/api/documents/similarities', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ content })
            });

            if (!response.ok) throw new Error('Failed to fetch similarities');
            
            const result = await response.json();
            
            // Show the results container
            const container = document.getElementById('resultsContainer');
            container.style.display = 'block';
            container.innerHTML = '<h3>Similar Documents Found</h3>';
            
            const similarityGraph = document.createElement('div');
            similarityGraph.id = 'similarityGraph';
            similarityGraph.className = 'similarity-graph';
            container.appendChild(similarityGraph);
            
            if (result.similarities && result.similarities.length > 0) {
                this.visualizeSimilarity(result.similarities);
            } else {
                similarityGraph.innerHTML = '<p>No similar documents found</p>';
            }
            
            this.showInfo('File already exists. Showing similarity results.');
        } catch (error) {
            this.showError('Failed to fetch similarities');
        }
    }

    async uploadOnly() {
        if (!this.selectedFile) {
            this.showError('No file selected');
            return;
        }

        try {
            const baseUrl = 'http://localhost:3000'; // Add base URL
            const formData = new FormData();
            formData.append('document', this.selectedFile);
            
            const checkResponse = await fetch(`${baseUrl}/api/documents/check`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                body: formData
            });

            // Add error handling for non-JSON responses
            let checkResult;
            try {
                checkResult = await checkResponse.json();
            } catch (e) {
                throw new Error('Server not responding correctly. Please make sure the server is running.');
            }
            
            if (checkResult.exists) {
                this.showInfo('File already exists in your uploads');
                this.resetUploadArea();
                return;
            }

            this.showLoadingBar();
            const uploadResponse = await fetch(`${baseUrl}/api/documents/upload`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                body: formData
            });

            let uploadResult;
            try {
                uploadResult = await uploadResponse.json();
            } catch (e) {
                throw new Error('Server not responding correctly. Please make sure the server is running.');
            }

            if (!uploadResponse.ok) {
                throw new Error(uploadResult.error || 'Upload failed');
            }

            this.showSuccess('File uploaded successfully');
            await this.loadRecentFiles();
            this.resetUploadArea();
        } catch (error) {
            this.showError(error.message || 'Upload failed');
        } finally {
            this.hideLoadingBar();
        }
    }

    resetUploadArea() {
        const dropZone = document.querySelector('.upload-box');
        dropZone.innerHTML = `
            <img src="../assets/images/Cloud character devours paper files.png" alt="Upload Icon">
            <p>Drag and Drop your file here</p>
            <p class="or-text">or</p>
            <button class="browse-btn">Browse</button>
            <input type="file" id="fileInput" accept=".txt" style="display: none;">
        `;
        
        // Hide scan actions
        document.querySelector('.scan-actions').style.display = 'none';
        
        // Reset file input
        document.getElementById('fileInput').value = '';
        
        // Clear selected file
        this.selectedFile = null;
        
        // Reattach event listeners
        this.setupDragDrop();
    }

    setupEventListeners() {
        const uploadBtn = document.querySelector('.upload-btn');
        const scanBtn = document.querySelector('.scan-btn');
        const fileInput = document.getElementById('fileInput');

        if (uploadBtn) {
            uploadBtn.addEventListener('click', () => this.uploadOnly());
        }
        if (scanBtn) {
            scanBtn.addEventListener('click', () => this.confirmAndScanFile());
        }
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.handleFileSelection(e.target.files[0]);
                }
            });
        }
    }

    updateFilePreview() {
        const dropZone = document.querySelector('.upload-box');
        if (!dropZone) return;

        dropZone.innerHTML = `
            <div class="file-preview">
                <img src="../assets/icons/file.png" alt="File Icon">
                <p>${this.selectedFile.name}</p>
                <button class="remove-file" onclick="dashboard.removeFile()">✕</button>
            </div>
        `;

        // Re-attach browse button listener
        const browseBtn = document.createElement('button');
        browseBtn.className = 'browse-btn';
        browseBtn.textContent = 'Browse';
        browseBtn.onclick = () => document.getElementById('fileInput').click();
        dropZone.appendChild(browseBtn);
    }

    removeFile() {
        this.selectedFile = null;
        const dropZone = document.querySelector('.upload-box');
        dropZone.innerHTML = `
            <img src="../assets/images/Cloud character devours paper files.png" alt="Upload Icon">
            <p>Drag and Drop your file here</p>
            <p class="or-text">or</p>
            <button class="browse-btn">Browse</button>
        `;
        this.setupDragDrop();
        // Disable scan button
        const scanBtn = document.querySelector('.scan-btn');
        scanBtn.disabled = true;
        scanBtn.style.opacity = '0.5';
    }

    async confirmAndScanFile() {
        if (!this.selectedFile) {
            this.showError('No file selected');
            return;
        }

        // Remove any existing dialog first
        const existingDialog = document.querySelector('.confirm-dialog');
        if (existingDialog) {
            existingDialog.remove();
        }

        return new Promise((resolve) => {
            const confirmDialog = document.createElement('div');
            confirmDialog.className = 'confirm-dialog';
            confirmDialog.innerHTML = `
                <div class="confirm-content">
                    <h3>Confirm Scan</h3>
                    <p>This will use 1 credit to scan "${this.selectedFile.name}"</p>
                    <p>You have ${this.credits} credits remaining.</p>
                    <div class="confirm-buttons">
                        <button class="confirm-yes">Proceed</button>
                        <button class="confirm-no">Cancel</button>
                    </div>
                </div>
            `;

            const cleanup = () => {
                const dialog = document.querySelector('.confirm-dialog');
                if (dialog) {
                    dialog.remove();
                }
            };

            const handleProceed = async () => {
                cleanup();
                await this.processFile();
                resolve(true);
            };

            const handleCancel = () => {
                cleanup();
                resolve(false);
            };

            document.body.appendChild(confirmDialog);
            confirmDialog.querySelector('.confirm-yes').addEventListener('click', handleProceed, { once: true });
            confirmDialog.querySelector('.confirm-no').addEventListener('click', handleCancel, { once: true });
        });
    }

    async processFile() {
        if (!this.selectedFile) {
            this.showError('No file selected');
            return;
        }

        this.showLoadingBar();
        try {
            const baseUrl = 'http://localhost:3000'; // Add base URL
            // First check if file exists
            const formData = new FormData();
            formData.append('document', this.selectedFile);

            const checkResponse = await fetch(`${baseUrl}/api/documents/check`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                body: formData
            });

            // Add error handling for non-JSON responses
            let checkResult;
            try {
                checkResult = await checkResponse.json();
            } catch (e) {
                throw new Error('Server not responding correctly. Please make sure the server is running.');
            }
            
            if (checkResult.exists) {
                await this.showExistingSimilarities(this.selectedFile);
                this.hideLoadingBar();
                return;
            }

            const response = await fetch(`${baseUrl}/api/documents/scan`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                body: formData
            });

            let result;
            try {
                result = await response.json();
            } catch (e) {
                throw new Error('Server not responding correctly. Please make sure the server is running.');
            }

            if (!response.ok) {
                if (result.error === 'File already exists') {
                    await this.showExistingSimilarities(this.selectedFile);
                    return;
                }
                throw new Error(result.error || 'Scan failed');
            }

            // Show results for new file
            const container = document.getElementById('resultsContainer');
            container.style.display = 'block';

            if (result.similarities && result.similarities.length > 0) {
                container.innerHTML = '<h3>Similar Documents Found</h3>';
                const similarityGraph = document.createElement('div');
                similarityGraph.id = 'similarityGraph';
                similarityGraph.className = 'similarity-graph';
                container.appendChild(similarityGraph);
                this.visualizeSimilarity(result.similarities);
            } else {
                container.innerHTML = '<h3>Scan Results</h3><p>No similar documents found.</p>';
            }

            await Promise.all([
                this.loadUserCredits(),
                this.loadRecentFiles()
            ]);

            this.resetUploadArea();
        } catch (error) {
            this.showError(error.message);
            console.error('API Error:', error);
        } finally {
            this.hideLoadingBar();
        }
    }

    // Smart file processing with queuing system
    async handleFiles(files) {
        this.uploadQueue.push(...files);
        if (!this.processingFile) {
            this.processQueue();
        }
    }

    async processQueue() {
        if (this.uploadQueue.length === 0) {
            this.processingFile = false;
            return;
        }

        this.processingFile = true;
        const file = this.uploadQueue.shift();
        try {
            await this.uploadAndScan(file);
        } catch (error) {
            this.showError(`Failed to process ${file.name}: ${error.message}`);
        }
        // Process next file
        await this.processQueue();
    }

    // Real-time progress updates
    updateProgress(percent) {
        const progress = document.querySelector('.loading-progress');
        const text = document.querySelector('.loading-text');
        progress.style.width = `${percent}%`;
        text.textContent = `Processing... ${Math.round(percent)}%`;
    }

    // Advanced credit management
    async setupCreditSystem() {
        const requestBtn = document.querySelector('.request-btn');
        requestBtn.addEventListener('click', async () => {
            const amount = document.getElementById('creditAmount').value;
            await this.requestCredits(parseInt(amount));
        });
    }

    setupLogout() {
        document.querySelector('.signout-btn').addEventListener('click', () => {
            localStorage.removeItem('token');
            localStorage.removeItem('userId');
            localStorage.removeItem('username');
            localStorage.removeItem('userRole');
            window.location.href = 'login'; // Remove .html extension
        });
    }

    connectWebSocket() {
        this.ws = new WebSocket(`ws://${window.location.hostname}:${window.location.port}`);
        this.ws.onopen = () => {
            this.ws.send(JSON.stringify({
                type: 'subscribe',
                userId: localStorage.getItem('userId')
            }));
        };
        this.ws.onmessage = (event) => this.handleWebSocketMessage(event);
    }

    handleWebSocketMessage(event) {
        const data = JSON.parse(event.data);
        switch(data.type) {
            case 'creditUpdate':
                this.updateCredits(data.credits);
                break;
            case 'scanComplete':
                this.showScanResults(data.results);
                break;
        }
    }

    async uploadAndScan(file) {
        const formData = new FormData();
        formData.append('document', file);
        try {
            this.updateProgress(0);
            const response = await fetch('/api/documents/scan', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                body: formData
            });
            
            if (!response.ok) throw new Error('Upload failed');
            const result = await response.json();
            this.visualizeSimilarity(result.similarities);
        } catch (error) {
            this.showError(error.message);
        }
    }

    visualizeSimilarity(similarities) {
        const container = document.getElementById('similarityGraph');
        if (!similarities || similarities.length === 0) {
            container.innerHTML = '<p>No similar documents found</p>';
            return;
        }
        container.innerHTML = `
            <h3>Similarity Results</h3>
            ${similarities
                .filter(sim => sim.similarity > 0) // Only show actual matches
                .map(sim => `
                    <div class="graph-bar">
                        <div class="bar-label">${sim.filename}</div>
                        <div class="bar-container">
                            <div class="bar" style="width: ${sim.similarity}%"></div>
                            <span class="percentage">${Math.round(sim.similarity)}%</span>
                        </div>
                        <div class="preview-text">${sim.content}</div>
                    </div>
                `).join('')}
        `;
    }

    async loadUserCredits() {
        try {
            const response = await fetch('/api/user/profile', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            
            if (!response.ok) {
                throw new Error('Failed to load credits');
            }
            
            const data = await response.json();
            this.credits = data.credits;
            
            const creditsElement = document.querySelector('.credits-count');
            if (creditsElement) {
                creditsElement.textContent = this.credits;
            }
        } catch (error) {
            console.error('Error loading credits:', error);
            const creditsElement = document.querySelector('.credits-count');
            if (creditsElement) {
                creditsElement.textContent = '0';
            }
        }
    }

    async loadRecentFiles() {
        try {
            const response = await fetch('/api/documents/recent', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });

            if (!response.ok) throw new Error('Failed to load recent files');

            const files = await response.json();
            this.updateFileTable(files);
        } catch (error) {
            console.error('Error loading recent files:', error);
        }
    }

    async updateFileTable(files) {
        const tbody = document.getElementById('fileTableBody');
        if (!files || files.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: center; color: gray;">No files uploaded</td>
                </tr>`;
            return;
        }

        tbody.innerHTML = files
            .filter(file => file.filename) // Filter out unnamed files
            .map(file => {
                const displayName = file.filename.includes('-') ? 
                    file.filename.split('-').slice(1).join('-') : 
                    file.filename;
                return `
                    <tr>
                        <td>${displayName}</td>
                        <td>${file.similarity ? Math.round(file.similarity) + '%' : 'N/A'}</td>
                        <td><button onclick="dashboard.viewFile(${file.id})">View</button></td>
                        <td><button onclick="dashboard.downloadFile(${file.id})">Download</button></td>
                    </tr>
                `;
            }).join('');
    }

    // Add these methods for view and download functionality
    async viewFile(id) {
        try {
            const response = await fetch(`/api/documents/${id}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (!response.ok) throw new Error('Failed to load file');
            
            const document = await response.json();
            
            // Create modal for viewing
            const modal = document.createElement('div');
            modal.className = 'view-modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>${document.filename}</h3>
                        <button onclick="this.closest('.view-modal').remove()">✕</button>
                    </div>
                    <div class="modal-body">
                        <pre>${document.content}</pre>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        } catch (error) {
            this.showError(error.message);
        }
    }

    async downloadFile(id) {
        try {
            const response = await fetch(`/api/documents/${id}/download`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            
            if (!response.ok) throw new Error('Download failed');
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = 'document.txt'; // Server will set proper filename
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            this.showError(error.message);
        }
    }

    // Add error notification
    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-notification';
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);
        
        // Fade out effect
        errorDiv.style.opacity = '1';
        setTimeout(() => {
            errorDiv.style.opacity = '0';
            setTimeout(() => errorDiv.remove(), 300);
        }, 2000);
    }

    showInfo(message) {
        const infoDiv = document.createElement('div');
        infoDiv.className = 'info-notification';
        infoDiv.textContent = message;
        document.body.appendChild(infoDiv);
        setTimeout(() => {
            infoDiv.style.opacity = '0';
            setTimeout(() => infoDiv.remove(), 300);
        }, 3000);
    }

    updateCredits(newCredits) {
        this.credits = newCredits;
        const creditsElement = document.querySelector('.credits-count');
        if (creditsElement) {
            creditsElement.textContent = newCredits;
        }
    }

    showSuccess(message) {
        const successDiv = document.createElement('div');
        successDiv.className = 'success-notification';
        successDiv.textContent = message;
        document.body.appendChild(successDiv);
        setTimeout(() => successDiv.remove(), 3000);
    }

    showScanResults(results) {
        this.hideLoadingBar();
        const container = document.querySelector('.results-container');
        if (results.length === 0) {
            container.innerHTML = '<p>No similar documents found.</p>';
            return;
        }
        this.visualizeSimilarity(results);
    }

    // Show loading bar
    showLoadingBar() {
        const container = document.querySelector('.loading-bar-container');
        container.style.display = 'block';
    }

    // Hide loading bar
    hideLoadingBar() {
        const container = document.querySelector('.loading-bar-container');
        container.style.display = 'none';
    }

    // Reset method to clean up any stuck dialogs
    resetDialogs() {
        const dialogs = document.querySelectorAll('.confirm-dialog, .view-modal');
        dialogs.forEach(dialog => dialog.remove());
    }
}

// Initialize dashboard
const dashboard = new DashboardController();

// Export for testing
if (typeof module !== 'undefined') {
    module.exports = DashboardController;
}
