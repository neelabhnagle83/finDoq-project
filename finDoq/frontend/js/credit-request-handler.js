/**
 * Credit Request Handler - Manages credit request functionality
 */
class CreditRequestHandler {
    constructor() {
        this.isProcessing = false;
        this.init();
    }
    
    init() {
        // Initialize on DOM ready
        document.addEventListener('DOMContentLoaded', () => {
            this.setupEventListeners();
        });
        
        // Also setup immediately in case DOM is already loaded
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            setTimeout(() => this.setupEventListeners(), 100);
        }
    }
    
    setupEventListeners() {
        // Find all credit request forms
        const forms = document.querySelectorAll('#credit-request-form, form.credit-request-form');
        
        forms.forEach(form => {
            // Skip if already initialized
            if (form.hasAttribute('data-initialized')) return;
            
            form.setAttribute('data-initialized', 'true');
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                
                // Find input and submit button
                const amountInput = form.querySelector('input[type="number"], #creditAmount');
                const submitBtn = form.querySelector('button[type="submit"]');
                
                if (!amountInput || !amountInput.value) {
                    this.showNotification('error', 'Error', 'Please enter a valid amount');
                    return;
                }
                
                const amount = parseInt(amountInput.value, 10);
                this.submitCreditRequest(amount, submitBtn);
            });
        });
        
        // Setup modal triggers - ensure they also remove any floating credit form
        const requestButtons = document.querySelectorAll('.request-credits-btn, #request-credits-btn');
        requestButtons.forEach(btn => {
            // Skip if already initialized
            if (btn.hasAttribute('data-initialized')) return;
            
            btn.setAttribute('data-initialized', 'true');
            btn.addEventListener('click', () => {
                // Remove any existing credit form at the bottom of the page
                const existingBottomForm = document.querySelector('.credit-request-floating');
                if (existingBottomForm) {
                    existingBottomForm.remove();
                }
                
                const modal = document.getElementById('credit-modal');
                if (modal) {
                    modal.style.display = 'flex';
                    modal.classList.remove('hidden');
                    
                    // Focus the input field for better UX
                    const amountInput = modal.querySelector('#creditAmount');
                    if (amountInput) {
                        setTimeout(() => amountInput.focus(), 300);
                    }
                }
            });
        });
        
        // Setup close buttons
        const closeButtons = document.querySelectorAll('.close-btn, .modal-close');
        closeButtons.forEach(btn => {
            // Skip if already initialized
            if (btn.hasAttribute('data-initialized')) return;
            
            btn.setAttribute('data-initialized', 'true');
            btn.addEventListener('click', () => {
                const modal = btn.closest('.modal');
                if (modal) {
                    modal.classList.add('hidden');
                }
            });
        });

        // Check for any floating request forms and hide them
        setTimeout(() => {
            const floatingForms = document.querySelectorAll('form.credit-request-form:not(.modal *)');
            floatingForms.forEach(form => {
                // Mark as floating
                form.classList.add('credit-request-floating');
                
                // Get parent container
                let container = form.parentElement;
                while (container && !container.classList.contains('credit-request-container')) {
                    container = container.parentElement;
                }
                
                if (container) {
                    // Hide the container
                    container.style.display = 'none';
                    
                    // Create a proper modal if needed
                    if (!document.getElementById('credit-modal')) {
                        this.createCreditModal(container.innerHTML);
                    }
                }
            });
        }, 500);
    }
    
    async submitCreditRequest(amount, button) {
        if (this.isProcessing) return;
        
        // Validate amount
        if (!amount || amount <= 0) {
            this.showNotification('error', 'Invalid Amount', 'Please enter a positive number');
            return;
        }
        
        // Set processing state
        this.isProcessing = true;
        if (button) {
            button.disabled = true;
            button.textContent = 'Processing...';
        }
        
        try {
            const response = await fetch('/api/credits/request', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ amount })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.showNotification('success', 'Request Submitted', 'Your credit request has been submitted successfully');
                
                // Close modal
                const modal = document.getElementById('credit-modal');
                if (modal) modal.classList.add('hidden');
                
                // Reset form
                const form = document.getElementById('credit-request-form');
                if (form) form.reset();
            } else {
                this.showNotification('error', 'Request Failed', data.error || 'Failed to submit request');
            }
        } catch (error) {
            console.error('Credit request error:', error);
            this.showNotification('error', 'Connection Error', 'Failed to connect to server');
        } finally {
            this.isProcessing = false;
            if (button) {
                button.disabled = false;
                button.textContent = 'Submit Request';
            }
        }
    }
    
    showNotification(type, title, message) {
        // Check if we have access to the scan handler's notification system
        if (window.scanHandler && typeof window.scanHandler.showNotification === 'function') {
            window.scanHandler.showNotification(type, title, message);
            return;
        }
        
        // Fallback notification system
        const container = document.querySelector('.notification-container') || 
            (() => {
                const cont = document.createElement('div');
                cont.className = 'notification-container';
                document.body.appendChild(cont);
                return cont;
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
        
        container.appendChild(notification);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => notification.remove(), 300);
        }, 5000);
        
        // Close button
        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.classList.add('fade-out');
            setTimeout(() => notification.remove(), 300);
        });
    }

    createCreditModal(innerHtml) {
        const modalHtml = `
            <div id="credit-modal" class="modal hidden">
                <div class="modal-content">
                    <button class="close-btn">&times;</button>
                    <div class="modal-header">
                        <h2>Request Credits</h2>
                    </div>
                    <div class="modal-body">
                        ${innerHtml || `
                            <p>About Credits:</p>
                            <ul>
                                <li>Each document scan costs 1 credit</li>
                                <li>You receive 20 free credits daily</li>
                                <li>Admin approval is required for additional credits</li>
                                <li>Requests are typically processed within 24 hours</li>
                            </ul>
                            <form id="credit-request-form">
                                <div class="form-group">
                                    <label for="creditAmount">How many credits would you like to request?</label>
                                    <input type="number" id="creditAmount" min="1" max="100" value="10" required>
                                </div>
                                <button type="submit">Submit Request</button>
                            </form>
                        `}
                    </div>
                </div>
            </div>
        `;
        
        // Add the modal to the body
        const modalDiv = document.createElement('div');
        modalDiv.innerHTML = modalHtml.trim();
        document.body.appendChild(modalDiv.firstChild);
        
        // Setup event listeners for the new modal
        setTimeout(() => this.setupEventListeners(), 100);
    }
}

// Initialize credit request handler
const creditRequestHandler = new CreditRequestHandler();
