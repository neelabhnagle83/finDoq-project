document.getElementById('signup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    try {
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
        localStorage.setItem('token', data.token);
        localStorage.setItem('userId', data.userId);
        localStorage.setItem('username', document.getElementById('username').value);
        window.location.href = '/dashboard';
    } catch (error) {
        alert('Registration failed: ' + error.message);
    }
});

// Toggle password visibility
document.getElementById('toggleSignupPassword').addEventListener('click', function() {
    const password = document.getElementById('signup-password');
    password.type = password.type === 'password' ? 'text' : 'password';
    this.src = password.type === 'password' ? '../assets/icons/mdi_hide.png' : '../assets/icons/mdi_show.png';
});
