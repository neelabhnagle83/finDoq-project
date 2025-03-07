document.addEventListener("DOMContentLoaded", function () {
    const loginForm = document.getElementById("login-form");
    const passwordInput = document.getElementById("password");
    const togglePassword = document.getElementById("togglePassword");

    // 🔥 Toggle password visibility
    togglePassword.addEventListener("click", function () {
        if (passwordInput.type === "password") {
            passwordInput.type = "text";
            togglePassword.src = "../assets/icons/mdi_show.png"; // Change icon
        } else {
            passwordInput.type = "password";
            togglePassword.src = "../assets/icons/mdi_hide.png"; // Change icon
        }
    });

    // 🔥 Login form submission
    loginForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const username = document.getElementById("username").value;
        const password = passwordInput.value;

        try {
            const response = await fetch("http://localhost:3000/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password }),
            });

            const result = await response.json();

            if (response.ok) {
                alert("✅ Login successful!");

                // ✅ Store JWT Token & Username in Local Storage
                localStorage.setItem("token", result.token);
                localStorage.setItem("username", username);

                // ✅ Redirect based on role
                if (result.role === "admin") {
                    localStorage.setItem("isAdmin", true); // Store admin session flag
                    window.location.href = "admin.html"; // Redirect Admins
                } else {
                    localStorage.setItem("isAdmin", false);
                    window.location.href = "dashboard.html"; // Redirect Users
                }
            } else {
                alert("❌ " + (result.error || "Invalid credentials!"));
            }
        } catch (error) {
            console.error("❌ Login Error:", error);
            alert("❌ Login failed. Try again later.");
        }
    });
});
