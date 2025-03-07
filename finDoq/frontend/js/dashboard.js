import { uploadFile } from './upload.js';

console.log("dashboard.js loaded");

document.addEventListener("DOMContentLoaded", function () {
    let token = localStorage.getItem("token");
    let username = localStorage.getItem("username");

    if (!token) {
        alert("⚠️ Unauthorized! Please log in first.");
        window.location.href = "login.html";
        return;
    }

    const creditsCountElement = document.querySelector('.credits-count');
    if (!creditsCountElement) {
        console.error("Credits count element not found in DOM.");
        return;
    }

    function updateCreditsDisplay(credits) {
        if (typeof credits === 'number' && !isNaN(credits)) {
            creditsCountElement.textContent = credits;
            localStorage.setItem("credits_" + username, credits);
        } else {
            creditsCountElement.textContent = '20'; // Default to 20 if invalid
            localStorage.setItem("credits_" + username, '20');
        }
    }

    // Fetch and display credits
    function fetchCredits() {
        token = localStorage.getItem("token"); // Refresh token before fetching

        if (!token) {
            console.error("No token found");
            updateCreditsDisplay(20); // Set default credits
            return;
        }

        fetch("http://localhost:3000/user/credits", {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        })
        .then(response => {
            console.log("Credits response status:", response.status); // Log the response status
            if (!response.ok) {
                console.error("Credits response error:", response.status, response.statusText);
                throw new Error(`HTTP error! status: ${response.status}, text: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            console.log("Credits response data:", data); // Log the response data
            if (data && data.credits !== undefined) {
                updateCreditsDisplay(data.credits);
            } else {
                updateCreditsDisplay(20);
                console.warn("No credits found, using default value");
            }
        })
        .catch(error => {
            console.error("Error fetching credits:", error);
            updateCreditsDisplay(20); // Set default credits on error
            if (error.message.includes("401")) {
                localStorage.removeItem("token");
                window.location.href = "login.html";
            }
        });
    }

    fetchCredits(); // Initial call to update credits

    // Request Credits Function
    document.querySelector('.request-btn').addEventListener('click', function () {
        let currentCredits = parseInt(creditsCountElement.textContent, 10);

        if (currentCredits > 5) {
            alert("⚠️ You can only request credits if you have 5 or fewer credits.");
            return;
        }

        const creditAmount = parseInt(document.querySelector('#creditAmount').value, 10);
        console.log("Credit Amount:", creditAmount); // Log the credit amount
        if (creditAmount >= 0 && creditAmount <= 10) {
            token = localStorage.getItem("token");  // Ensure the token is retrieved
            
            if (!token) {
                alert("⚠️ You need to be logged in to request credits.");
                return;
            }

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
                    alert(data.error);
                } else {
                    alert(data.message);
                    fetchCredits();
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
        const fileInput = document.getElementById("fileInput");
        if (!fileInput) {
            console.error("File input element not found in DOM.");
            alert("⚠️ File input not found.");
            return;
        }
        if (fileInput.files.length === 0) {
            alert("⚠️ No file selected! Please choose a file before scanning.");
            return;
        }
        const file = fileInput.files[0];
        console.log("File selected:", file);

        // Show loading indicator
        const scanButton = document.querySelector('.scan-btn');
        scanButton.disabled = true;
        scanButton.textContent = 'Scanning...';
        document.querySelector('.loading-bar-container').style.display = 'block';

        uploadFile(file)
            .then(data => {
                // Initiate the scan after successful upload
                scanDocument(data.documentId);
            })
            .catch(error => {
                // Hide loading indicator
                scanButton.disabled = false;
                scanButton.textContent = 'Scan';
                document.querySelector('.loading-bar-container').style.display = 'none';
                console.error("Error during file upload:", error);
                alert("⚠️ Something went wrong while uploading the file. Please try again later.");
            });
    });

    
    function uploadFile(file) {
        return new Promise((resolve, reject) => {
            const formData = new FormData();
            formData.append("file", file);

            token = localStorage.getItem("token"); // Ensure token is up-to-date
            fetch("http://localhost:3000/user/upload", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`
                },
                body: formData
            })
            .then(response => {
                console.log("Upload response status:", response.status); // ADD THIS LINE
                if (!response.ok) { // Check if the response status is not OK
                    console.error("Upload response error:", response.status, response.statusText); // ADD THIS LINE
                    return response.json().then(err => { throw err; }); // ADD THIS LINE
                }
                return response.json();
            })
            .then(data => {
                if (data.error) {
                    console.error("Upload error:", data.error);
                    alert(data.error);
                    reject(data.error);
                } else {
                    console.log("Upload response:", data);
                    resolve({ documentId: data.documentId }); // MODIFIED THIS LINE
                }
            })
            .catch(error => {
                console.error("Error uploading file:", error);
                alert("⚠️ Something went wrong while uploading the file. Please try again later.");
                reject(error);
            });
        });
    }

    function scanDocument(documentId) {
        const token = localStorage.getItem('token');
        const loadingBarContainer = document.querySelector('.loading-bar-container');
        const loadingProgress = document.querySelector('.loading-progress');
        const loadingText = document.querySelector('.loading-text');

        loadingBarContainer.style.display = 'block';
        loadingProgress.style.width = '0%';
        loadingText.textContent = 'Starting scan... 0%';

        const scanUrl = `http://localhost:3000/scan/${documentId}`;
        console.log("Scanning document with ID:", documentId); // ADD THIS LINE
        const username = localStorage.getItem('username');
        let progress = 0;

        // Reset and show loading bar
        loadingProgress.style.width = '0%';
        loadingBarContainer.style.display = 'block';

        // Animate progress bar
        const progressInterval = setInterval(() => {
            progress += 2;
            if (progress <= 90) {
                loadingProgress.style.width = `${progress}%`;
                loadingText.textContent = `Scanning in progress... ${progress}%`;
            }
        }, 100);

        token = localStorage.getItem("token");
        fetch(`http://localhost:3000/scan/${documentId}`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        })
        .then(response => response.json())
        .then(data => {
            clearInterval(progressInterval);
            loadingProgress.style.width = '100%';
            loadingText.textContent = 'Scan complete!';

            if (data.success) {
                displaySimilarDocuments(data.similarDocuments);
                deductCredit()
                .then(() => {
                    setTimeout(() => {
                        loadingBarContainer.style.display = 'none';
                    }, 500);
                })
                .catch(creditError => {
                    loadingBarContainer.style.display = 'none';
                    console.error("Error deducting credit:", creditError);
                    alert("⚠️ Scan completed, but credit deduction failed.");
                });
            } else {
                loadingBarContainer.style.display = 'none';
                alert("⚠️ " + (data.error || "Scan failed"));
            }
        })
        .catch(error => {
            clearInterval(progressInterval);
            loadingBarContainer.style.display = 'none';
            console.error("Error during scan:", error);
            alert("⚠️ Something went wrong during the scan. Please try again later.");
        });
    }

    function displaySimilarDocuments(similarDocuments) {
        const existingResults = document.querySelector('.results-container');
        if (existingResults) {
            existingResults.remove();
        }

        const resultsContainer = document.createElement('div');
        resultsContainer.className = 'results-container';

        if (!similarDocuments || similarDocuments.length === 0) {
            resultsContainer.innerHTML = '<h3>No similar documents found</h3>';
            document.querySelector('.upload-box').after(resultsContainer);
            return;
        }

        // Sort documents by similarity
        similarDocuments.sort((a, b) => b.similarity - a.similarity);

        // Create visual graph
        let graphHTML = `
            <h3>Similarity Results</h3>
            <div class="similarity-graph">
                ${similarDocuments.slice(0, 10).map(doc => `
                    <div class="graph-bar">
                        <div class="bar-label">${doc.file_name}</div>
                        <div class="bar-container">
                            <div class="bar" style="width: ${doc.similarity * 100}%"></div>
                            <span class="percentage">${(doc.similarity * 100).toFixed(1)}%</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        resultsContainer.innerHTML = graphHTML;
        document.querySelector('.upload-box').after(resultsContainer);
    }

    // Deduct 1 Credit After Scanning
    function deductCredit() {
        return new Promise((resolve, reject) => {
            const currentCredits = parseInt(creditsCountElement.textContent);
            if (currentCredits <= 0) {
                alert("⚠️ No credits remaining!");
                reject("No credits remaining!");
                return;
            }

            token = localStorage.getItem("token"); // Refresh token before deducting

            fetch("http://localhost:3000/user/deduct-credit", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                }
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    fetchCredits(); // Fetch new credit count after deduction
                    resolve();
                } else {
                    alert(data.error || "Error deducting credit.");
                    fetchCredits(); // Refresh credits display anyway
                    reject(data.error || "Error deducting credit.");
                }
            })
            .catch(error => {
                console.error("Error deducting credit:", error);
                fetchCredits(); // Refresh credits display on error
                reject(error);
            });
        });
    }
});

