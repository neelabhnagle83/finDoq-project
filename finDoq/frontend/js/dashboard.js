console.log("dashboard.js loaded");

document.addEventListener("DOMContentLoaded", function () {
    const token = localStorage.getItem("token");
    let username = localStorage.getItem("username");

    if (!token) {
        alert("⚠️ Unauthorized! Please log in first.");
        window.location.href = "login.html";
        return;
    }

    const creditsCountElement = document.querySelector('.credits-count');
    const fileInput = document.querySelector('#fileInput'); // Ensure this element exists

    function updateCreditsDisplay(credits) {
        creditsCountElement.textContent = credits;
        localStorage.setItem("credits" + username, credits);
    }

    // Fetch and display credits
    function fetchCredits() {
        const token = localStorage.getItem("token");
        
        if (!token) {
            alert("⚠️ No token found. Please log in.");
            return;
        }
    
        fetch("http://localhost:3000/user/credits", {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.credits !== undefined) {
                updateCreditsDisplay(data.credits);
            } else {
                console.error("Credits data is undefined.");
            }
        })
        .catch(error => console.error("Error fetching credits:", error));
    }
    
    fetchCredits();
      // Initial call to update credits

    // Request Credits Function
    document.querySelector('.request-btn').addEventListener('click', function () {
        let currentCredits = parseInt(creditsCountElement.textContent, 10);
    
        if (currentCredits > 5) {
            alert("⚠️ You can only request credits if you have 5 or fewer credits.");
            return;
        }
    
        const creditAmount = parseInt(document.querySelector('#creditAmount').value, 10);
        if (creditAmount >= 0 && creditAmount <= 10) {
            const token = localStorage.getItem("token");  // Ensure the token is retrieved
            
            // Check if the token is available
            if (!token) {
                alert("⚠️ You need to be logged in to request credits.");
                return;
            }
    
            // Make the request to the backend
            fetch("http://localhost:3000/user/request-credits", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ requestedCredits: creditAmount })
            })
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    alert(data.error);  // Show error if the backend sends an error
                } else {
                    alert(data.message);  // Show success message
    
                    // After the request is successful, trigger the fetch to update credits
                    fetchCredits();  // Function to update the user's current credits
    
                    // Optionally, trigger a notification for the admin (if your backend handles it)
                    fetch("http://localhost:3000/admin/credit-requests", {
                        method: "GET",
                        headers: {
                            "Authorization": `Bearer ${token}`
                        }
                    })
                    .then(response => response.json())
                    .then(adminData => {
                        if (adminData && adminData.requests) {
                            // Here you can update the notifications section or inform the admin
                            // about the new credit request (this part can be used for the admin page).
                        }
                    })
                    .catch(err => console.error("Error fetching admin requests:", err));
                }
            })
            .catch(error => {
                console.error("Error requesting credits:", error);
                alert("⚠️ Something went wrong while making the credit request. Please try again later.");
            });
        } else {
            alert("⚠️ Please enter a valid number of credits (between 0 and 10).");
        }
    });
    

    // Logout function
    function logout() {
        localStorage.removeItem("token");
        localStorage.removeItem("username");
        localStorage.removeItem("credits_" + username);
        window.location.href = "login.html";
    }

    document.querySelector('.signout-btn').addEventListener('click', logout);

    // **Scanning & Deducting Credit**
    document.querySelector('.scan-btn').addEventListener('click', function () {
        console.log("Scan button clicked");
    
        const fileInput = document.querySelector('#fileInput'); // Ensure this exists
        console.log("File input element:", fileInput);
    
        if (!fileInput) {
            alert("⚠️ File input not found in DOM.");
            return;
        }
    
        const file = fileInput.files[0]; // Get the selected file
        console.log("File selected:", file);
    
        if (!file) {
            alert("⚠️ No file selected! Please choose a file before scanning.");
            return;
        }
    
        alert("✅ Scanning started...");
    
        setTimeout(() => {
            alert("⏳ Scanning in progress...");
            console.log("Scanning in progress...");
    
            setTimeout(() => {
                uploadFile(file); // Call the function to upload
                deductCredit(); // Deduct 1 credit
            }, 1000);
    
        }, 1000);
    });
    
    

    // Deduct 1 Credit After Scanning
    function deductCredit() {
        fetch("http://localhost:3000/user/deduct-credit", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`, // Fixed template literal syntax
                "Content-Type": "application/json"
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                fetchCredits(); // Fetch new credit count after deduction
            } else {
                alert(data.error || "Error deducting credit.");
            }
        })
        .catch(error => console.error("Error deducting credit:", error));
    }
});
