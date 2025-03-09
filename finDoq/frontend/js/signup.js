document.getElementById('signup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    try {
        // Show loading state
        const submitButton = document.querySelector('#signup-form button[type="submit"]');
        const originalText = submitButton.textContent;
        submitButton.textContent = "Creating Account...";
        submitButton.disabled = true;
        
        const response = await fetch('http://localhost:3000/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: document.getElementById('username').value,
                password: document.getElementById('signup-password').value
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Registration failed');
        }

        const data = await response.json();
        
        // Store user data in localStorage
        localStorage.setItem('token', data.token);
        
        // Extract user ID from the token
        const payload = JSON.parse(atob(data.token.split('.')[1]));
        localStorage.setItem('userId', payload.id);
        localStorage.setItem('username', document.getElementById('username').value);
        localStorage.setItem('userRole', 'user');
        
        // Show success message
        showNotification('Account created successfully! Redirecting...', 'success');
        
        // Redirect after a short delay
        setTimeout(() => {
            window.location.href = '/dashboard';
        }, 1500);
    } catch (error) {
        showNotification('Registration failed: ' + error.message, 'error');
        
        // Reset button state
        const submitButton = document.querySelector('#signup-form button[type="submit"]');
        submitButton.textContent = originalText;
        submitButton.disabled = false;
    }
});

// Toggle password visibility
document.getElementById('toggleSignupPassword').addEventListener('click', function() {
    const password = document.getElementById('signup-password');
    password.type = password.type === 'password' ? 'text' : 'password';
    this.src = password.type === 'password' ? '../assets/icons/mdi_hide.png' : '../assets/icons/mdi_show.png';
});

// Show notification function
function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
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
