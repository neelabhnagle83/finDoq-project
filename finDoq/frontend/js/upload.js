class FileUploadHandler {
    constructor() {
        this.setupDropZone();
    }

    setupDropZone() {
        const dropZone = document.querySelector('.upload-box');
        if (!dropZone) return;

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        dropZone.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            window.dashboard?.handleFiles(files);
        });
    }
}

// Initialize
new FileUploadHandler();
