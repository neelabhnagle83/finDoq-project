document.addEventListener("DOMContentLoaded", function () {
    const token = localStorage.getItem("token");

    if (!token) {
        alert("⚠️ Unauthorized! Please log in first.");
        window.location.href = "login.html";
        return;
    }

    fetch("http://localhost:3000/user/profile", {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${token}`
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            alert("❌ " + data.error);
            return;
        }

        document.getElementById("username").textContent = data.username;
        document.getElementById("credits").textContent = data.credits;

        const documentsList = document.getElementById("documents-list");
        documentsList.innerHTML = "";
        data.documents.forEach(doc => {
            const li = document.createElement("li");
            li.textContent = doc.file_name;
            documentsList.appendChild(li);
        });

        const requestsList = document.getElementById("requests-list");
        requestsList.innerHTML = "";
        data.creditRequests.forEach(req => {
            const li = document.createElement("li");
            li.textContent = `Requested ${req.creditsRequested} credits - ${req.status}`;
            requestsList.appendChild(li);
        });
    })
    .catch(error => {
        console.error("Error fetching profile:", error);
        alert("❌ Error fetching profile. Please try again later.");
    });
});

function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    alert("✅ Logged out successfully!");
    window.location.href = "login.html";
}