document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    try {
        // Show loading indicator if available
        if (document.getElementById('loading-indicator')) {
            document.getElementById('loading-indicator').classList.remove('hidden');
        }
        
        const response = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: document.getElementById('username').value,
                password: document.getElementById('password').value
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Login failed');
        }

        const data = await response.json();
        localStorage.setItem('token', data.token);
        localStorage.setItem('userId', data.userId);
        localStorage.setItem('username', data.username);
        localStorage.setItem('userRole', data.role);
        
        // Store the user's actual credits from the server response
        // This ensures we don't reset to initial value
        if (data.credits !== undefined) {
            localStorage.setItem('userCredits', data.credits);
            console.log(`User credits loaded from server: ${data.credits}`);
        }
        
        // Important: Disable mock data by default after login
        localStorage.setItem('useMockData', 'false');
        
        // Reset API error counter on successful login
        localStorage.setItem('apiErrorCount', '0');

        // Hide loading indicator if available
        if (document.getElementById('loading-indicator')) {
            document.getElementById('loading-indicator').classList.add('hidden');
        }

        // Redirect based on role
        if (data.role === 'admin') {
            window.location.href = '/admin';
        } else {
            window.location.href = '/dashboard';
        }
    } catch (error) {
        // Hide loading indicator if available
        if (document.getElementById('loading-indicator')) {
            document.getElementById('loading-indicator').classList.add('hidden');
        }
        
        // Show error message in a more user-friendly way if element exists
        const errorElement = document.getElementById('login-error');
        if (errorElement) {
            errorElement.textContent = error.message;
            errorElement.classList.remove('hidden');
        } else {
            alert('Login failed: ' + error.message);
        }
    }
});

// Password toggle functionality
document.getElementById('togglePassword').addEventListener('click', function() {
    const password = document.getElementById('password');
    password.type = password.type === 'password' ? 'text' : 'password';
    this.src = password.type === 'password' ? '../assets/icons/mdi_hide.png' : '../assets/icons/mdi_show.png';
});
