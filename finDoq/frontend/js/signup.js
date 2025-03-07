document.addEventListener("DOMContentLoaded", function () {
    const signupForm = document.getElementById("signup-form");
    const passwordInput = document.getElementById("signup-password");
    const togglePassword = document.getElementById("toggleSignupPassword");

    // Toggle password visibility
    togglePassword.addEventListener("click", function () {
        if (passwordInput.type === "password") {
            passwordInput.type = "text";
            togglePassword.src = "../assets/icons/mdi_show.png"; // Change icon
        } else {
            passwordInput.type = "password";
            togglePassword.src = "../assets/icons/mdi_hide.png"; // Change icon
        }
    });

    // Signup form submission
    signupForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const username = document.getElementById("username").value.trim();
        const password = passwordInput.value.trim();

        if (!username || !password) {
            alert("❌ Username and password are required!");
            return;
        }

        try {
            const response = await fetch("http://localhost:3000/signup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password }),
            });

            const result = await response.json();

            if (response.ok) {
                alert("✅ Signup successful! Please login.");
                window.location.href = "login.html"; // Redirect to login page
            } else {
                console.error("Signup Failed:", result.error);
                alert("❌ " + result.error);
            }
        } catch (error) {
            console.error("Signup Error:", error);
            alert("❌ Signup failed. Try again later.");
        }
    });
});
