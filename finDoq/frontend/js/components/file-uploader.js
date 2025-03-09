import NotificationManager from '../ui/notifications.js';

export default class FileUploader {
    constructor() {
        this.dropZone = document.querySelector('.upload-box');
        this.fileInput = document.getElementById('fileInput');
        this.setupDragDrop();
        this.onFileSelected = null; // Add this line
        this.fileQueue = [];
        this.isProcessing = false;
        this.setupFileInput();
    }

    setupDragDrop() {
        if (!this.dropZone || !this.fileInput) return;
        
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            this.dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });
        
        this.dropZone.addEventListener('dragover', this.handleDragOver.bind(this));
        this.dropZone.addEventListener('dragleave', this.handleDragLeave.bind(this));
        this.dropZone.addEventListener('drop', this.handleDrop.bind(this));
        this.fileInput.addEventListener('change', this.handleFileInput.bind(this));
    }

    setupFileInput() {
        const fileInput = document.getElementById('fileInput');
        const browseBtn = document.querySelector('.browse-btn');
        
        if (fileInput && browseBtn) {
            browseBtn.onclick = (e) => {
                e.preventDefault();
                fileInput.click();
            };
            
            fileInput.onchange = (e) => {
                if (e.target.files.length > 0) {
                    this.handleFileInput(e);
                }
            };
        }
    }

    handleDragOver(e) {
        e.preventDefault();
        this.dropZone.classList.add('drag-over');
    }

    handleDragLeave() {
        this.dropZone.classList.remove('drag-over');
    }

    handleDrop(e) {
        e.preventDefault();
        this.dropZone.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file) this.validateAndProcessFile(file);
    }

    handleFileInput(e) {
        if (e.target.files.length > 0) {
            this.validateAndProcessFile(e.target.files[0]);
        }
    }

    validateAndProcessFile(file) {
        const validExtensions = ['.txt', '.doc', '.docx'];
        const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
        
        if (!validExtensions.includes(ext)) {
            NotificationManager.error(`Please upload a valid document (${validExtensions.join(', ')})`);
            return null;
        }

        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            NotificationManager.error('File size should be less than 10MB');
            return null;
        }

        // Add virus check placeholder
        if (this.checkForVirus && !this.checkForVirus(file)) {
            NotificationManager.error('File security check failed');
            return null;
        }

        if (this.onFileSelected) {
            this.onFileSelected(file);
        }
        return file;
    }

    async processFileQueue() {
        if (this.isProcessing || this.fileQueue.length === 0) return;
        
        this.isProcessing = true;
        try {
            const file = this.fileQueue.shift();
            await this.processFile(file);
        } finally {
            this.isProcessing = false;
            if (this.fileQueue.length > 0) {
                setTimeout(() => this.processFileQueue(), 100);
            }
        }
    }

    updatePreview(filename) {
        if (!this.dropZone) return;
        this.dropZone.innerHTML = `
            <div class="file-preview">
                <div class="file-info">
                    <span class="file-name">${filename}</span>
                </div>
                <button class="remove-file">✕</button>
            </div>
            <input type="file" id="fileInput" accept=".txt" style="display: none;">
            <button class="browse-btn">Browse</button>
        `;
        this.setupDragDrop();
        this.setupFileInput(); // Re-setup after preview update
    }

    reset() {
        if (!this.dropZone) return;
        this.dropZone.innerHTML = `
            <img src="../assets/images/Cloud character devours paper files.png" alt="Upload Icon">
            <p>Drag and Drop your file here</p>
            <p class="or-text">or</p>
            <button class="browse-btn">Browse</button>
            <input type="file" id="fileInput" accept=".txt" style="display: none;">
        `;
        this.setupDragDrop();
        this.setupFileInput(); // Re-setup after reset
    }
}
