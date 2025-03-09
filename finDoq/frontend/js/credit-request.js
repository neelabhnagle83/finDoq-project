// Credit request handler for managing credit requests
class CreditRequestHandler {
    constructor() {
        this.isLocked = false;
        this.init();
    }

    init() {
        const form = document.getElementById('credit-request-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const amount = document.getElementById('creditAmount').value;
                const submitButton = form.querySelector('button[type="submit"]');
                this.handleRequest(amount, submitButton);
            });
        }
    }

    async handleRequest(amount, button) {
        if (this.isLocked) return;
        this.isLocked = true;

        try {
            const requestId = Date.now().toString();
            const response = await fetch('/api/credits/request', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ amount, requestId })
            });

            const data = await response.json();

            if (response.ok && data.confirmed) {
                this.showFeedback('Credit request submitted successfully!', 'success');
                this.updateRequestTable(data);
                const input = document.getElementById('creditAmount');
                if (input) input.value = '';

                // Close the modal
                document.getElementById('credit-modal').classList.add('hidden');
                
                // Trigger credit refresh in dashboard
                if (window.dashboardController) {
                    await window.dashboardController.loadUserCredits();
                }
                return;
            } else {
                this.showFeedback(data.error || 'Request failed', 'error');
            }
        } catch (error) {
            this.showFeedback('Network error, please try again', 'error');
            console.error(error);
        } finally {
            this.isLocked = false;
            if (button) button.disabled = false;
        }
    }

    showFeedback(message, type) {
        const feedbackDiv = document.createElement('div');
        feedbackDiv.className = `feedback ${type}`;
        feedbackDiv.textContent = message;
        
        document.body.appendChild(feedbackDiv);
        
        setTimeout(() => {
            feedbackDiv.remove();
        }, 3000);
    }

    updateRequestTable(data) {
        // This would be implemented if we had a requests table in the user dashboard
        // For now, it's a placeholder for future functionality
    }
}

// Initialize the handler
const creditRequestHandler = new CreditRequestHandler();
window.creditRequestHandler = creditRequestHandler;
