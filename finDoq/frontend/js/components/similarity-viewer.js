export default class SimilarityViewer {
    constructor() {
        this.container = document.getElementById('similarity-results');
        this.noMatchesMessage = 'No similar documents found';
    }

    showScanResults(similarities) {
        if (!this.container) {
            console.error('Similarity container element not found');
            return;
        }

        if (!similarities || similarities.length === 0) {
            this.container.innerHTML = `<p>${this.noMatchesMessage}</p>`;
            return;
        }

        // Support both array format and matches property
        const matchesArray = Array.isArray(similarities) ? 
            similarities : (similarities.matches || []);

        this.container.innerHTML = `
            <h3>Similarity Results</h3>
            ${matchesArray
                .filter(sim => sim.similarity > 0)
                .map(sim => `
                    <div class="graph-bar ${sim.isCurrentFile ? 'current-file' : ''}">
                        <div class="bar-label">
                            ${sim.filename || sim.documentName || 'Unknown Document'}
                            ${sim.isCurrentFile ? '<span class="current-file-badge">CURRENT FILE</span>' : ''}
                        </div>
                        <div class="bar-container">
                            <div class="bar" style="width: ${Math.min(100, Math.max(1, sim.similarity))}%"></div>
                            <span class="percentage">${Math.round(sim.similarity)}%</span>
                        </div>
                        <div class="preview-text">${sim.previewContent || sim.content || 'Preview not available'}</div>
                        <div class="match-actions">
                            <button class="view-full-btn" data-doc-id="${sim.documentId || sim.id || ''}">View Document</button>
                        </div>
                    </div>
                `).join('')}
        `;

        // Show the results container
        const resultsContainer = document.getElementById('resultsContainer');
        if (resultsContainer) {
            resultsContainer.style.display = 'block';
        }

        // Add event listeners to view document buttons
        this.container.querySelectorAll('.view-full-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const docId = btn.getAttribute('data-doc-id');
                if (docId && window.dashboardController && typeof window.dashboardController.viewFullDocument === 'function') {
                    window.dashboardController.viewFullDocument(docId);
                }
            });
        });
    }

    clearResults() {
        if (this.container) {
            this.container.innerHTML = '';
        }
        
        const resultsContainer = document.getElementById('resultsContainer');
        if (resultsContainer) {
            resultsContainer.style.display = 'none';
        }
    }
}
