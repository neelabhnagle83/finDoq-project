// Function to switch between sections
function showSection(sectionId) {
    document.querySelectorAll('.section-content').forEach(section => {
        section.classList.remove('active');
    });

    document.querySelectorAll('.admin-navbar span').forEach(tab => {
        tab.classList.remove('active');
    });

    document.getElementById(sectionId).classList.add('active');
    document.querySelector(`[onclick="showSection('${sectionId}')"]`).classList.add('active');
}

// Logout Function (Copied from Dashboard)
function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    alert("✅ Logged out successfully!");
    window.location.href = "login.html";
}

// Function to toggle all checkboxes when "Select All" is clicked for files
function toggleSelectAllFiles(selectAllCheckbox) {
    const checkboxes = document.querySelectorAll('.file-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.checked = selectAllCheckbox.checked;
    });
}

// Function to delete selected files
function deleteSelectedFiles() {
    const checkboxes = document.querySelectorAll('#fileTableBody input[type="checkbox"]:checked');

    if (checkboxes.length === 0) {
        alert("⚠️ Please select at least one file to delete.");
        return;
    }

    const confirmed = confirm("Are you sure you want to delete the selected files?");
    if (!confirmed) return;

    let deletionCount = 0;
    let errorOccurred = false;
    const totalCheckboxes = checkboxes.length;

    checkboxes.forEach(checkbox => {
        const fileId = checkbox.getAttribute("data-file-id");
        const row = checkbox.closest("tr");

        console.log(`Client: Deleting file with ID: ${fileId}`);

        const token = localStorage.getItem("token");
        fetch(`http://localhost:3000/admin/files/${fileId}`, {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${token}`
            }
        })
        .then(response => {
            console.log(`Client: Response received for file ID ${fileId}:`, response);
            if (!response.ok) {
                console.error(`Client: Unexpected status code for file ID ${fileId}:`, response.status);
                throw new Error(`Unexpected status code: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log(`Client: Data received for file ID ${fileId}:`, data);
            row.remove();
            console.log(`Client: File with ID ${fileId} deleted:`, data.message);
            deletionCount++;
        })
        .catch(error => {
            console.error(`Client: Fetch error for file ID ${fileId}:`, error);
            alert("⚠️ An error occurred while deleting the file.");
            errorOccurred = true;
        });
    });

    setTimeout(() => {
        if (errorOccurred) {
            alert("⚠️ Some errors occurred while deleting files. Please check the console.");
        } else if (deletionCount === totalCheckboxes) {
            alert("✅ Selected files have been deleted successfully.");
        } else {
            alert("✅ Some files were deleted successfully.");
        }
    }, 100 * totalCheckboxes);
}


// Function to load files from the database
function loadFilesFromDB() {
    const token = localStorage.getItem("token");
    const fileTableBody = document.getElementById("fileTableBody");
    fileTableBody.innerHTML = ""; // Clear existing files

    fetch("http://localhost:3000/admin/files", {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${token}`
        }
    })
    .then(response => response.json())
    .then(data => {
        if (!data || !data.files || data.files.length === 0) {
            fileTableBody.innerHTML =
                `<tr><td colspan="6" style="text-align: center; color: gray;">No files uploaded</td></tr>`;
            return;
        }

        data.files.forEach(file => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td><input type="checkbox" class="file-checkbox" data-file-id="${file.id}"></td>
                <td>${file.fileName}</td> 
                <td>${file.uploadedAt ? new Date(file.uploadedAt).toLocaleString() : 'N/A'}</td>
                <td>${file.size ? formatFileSize(file.size) : 'N/A'}</td>
                <td><button onclick="viewFile('${file.id}')">👁️ View</button></td>
                <td><button onclick="downloadFile('${file.id}')">⬇️ Download</button></td>
            `;
            fileTableBody.appendChild(row);
        });
    })
    .catch(error => {
        console.error("Error fetching files:", error);
        // Consider displaying a user-friendly error message on the page.
    });
}


// Helper function to format file size (KB, MB, GB)
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(k)));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Placeholder functions for viewing and downloading files
function viewFile(fileName) {
    alert(`Opening file: ${fileName}`);
}

function downloadFile(fileName) {
    alert(`Downloading file: ${fileName}`);
}

// Function to toggle all checkboxes when "Select All" is clicked for users
function toggleSelectAllUsers(selectAllCheckbox) {
    const checkboxes = document.querySelectorAll('.user-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.checked = selectAllCheckbox.checked;
    });
}

// Function to delete selected users

function deleteSelectedUsers() { 
    const checkboxes = document.querySelectorAll('.user-checkbox:checked');

    if (checkboxes.length === 0) {
        alert("⚠️ Please select at least one user to delete.");
        return;
    }

    const confirmed = confirm("Are you sure you want to delete the selected users?");
    if (!confirmed) return;

    let deletionCount = 0;
    let errorOccurred = false;
    const totalCheckboxes = checkboxes.length;
    const token = localStorage.getItem("token");

    const deleteUser = (userId, row) => {
        return fetch(`http://localhost:3000/admin/users/${userId}`, {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${token}`
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Unexpected status code: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log(`Client: User with ID ${userId} deleted:`, data.message);
            deletionCount++;
        })
        .catch(error => {
            console.error(`Client: Fetch error for user ID ${userId}:`, error);
            errorOccurred = true;
        });
    };

    const deletePromises = Array.from(checkboxes).map(checkbox => {
        const userId = checkbox.getAttribute("data-user-id");
        const row = checkbox.closest("tr");
        return deleteUser(userId, row);
    });

    Promise.allSettled(deletePromises).then(() => {
        if (errorOccurred) {
            alert("⚠️ Some errors occurred while deleting users. Please check the console.");
        } else {
            alert("✅ Selected users have been deleted successfully.");
        }
        window.location.reload(); // Reload page to update user list
    });
}



// Function to load users from the database
function loadUsersFromDB() {
    const token = localStorage.getItem("token");
    const userTableBody = document.getElementById("userTableBody");
    userTableBody.innerHTML = ""; // Clear existing users

    fetch("http://localhost:3000/admin/users", {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${token}`
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.users.length === 0) {
            userTableBody.innerHTML = 
                `<tr><td colspan="5" style="text-align: center; color: gray;">No users available</td></tr>`;
            return;
        }

        data.users.forEach(user => {
            const row = document.createElement("tr");
            row.innerHTML = 
                `<td><input type="checkbox" class="user-checkbox" data-user-id="${user.id}"></td>
                <td>${user.username}</td>
                <td>${user.role}</td>
                <td>${user.filesUploaded}</td>
                <td>${user.credits}</td>`;
            userTableBody.appendChild(row);
        });
    })
    .catch(error => console.error("Error fetching users:", error));
}

// Function to toggle all checkboxes when "Select All" is clicked for credit requests
// Function to accept selected credit requests
function acceptSelectedRequests() {
    const checkboxes = document.querySelectorAll('.request-checkbox:checked');
    
    if (checkboxes.length === 0) {
        alert("⚠️ Please select at least one request to accept.");
        return;
    }

    const confirmed = confirm("Are you sure you want to accept the selected credit requests?");
    if (!confirmed) return;

    checkboxes.forEach(checkbox => {
        const row = checkbox.closest("tr"); // Get the row of the selected request
        row.remove(); // Remove the row from the table
    });

    alert("✅ Selected credit requests have been accepted.");
}

// Function to reject selected credit requests
function rejectSelectedRequests() {
    const checkboxes = document.querySelectorAll('.request-checkbox:checked');
    
    if (checkboxes.length === 0) {
        alert("⚠️ Please select at least one request to reject.");
        return;
    }

    const confirmed = confirm("Are you sure you want to reject the selected credit requests?");
    if (!confirmed) return;

    checkboxes.forEach(checkbox => {
        const row = checkbox.closest("tr"); // Get the row of the selected request
        row.remove(); // Remove the row from the table
    });

    alert("✅ Selected credit requests have been rejected.");
}

// Function to load credit requests from the database
function loadRequestsFromDB() {
    const token = localStorage.getItem("token");
    const requestTableBody = document.getElementById("requestTableBody");
    requestTableBody.innerHTML = ""; // Clear existing requests

    fetch("http://localhost:3000/admin/credit-requests", {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${token}`
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.requests.length === 0) {
            requestTableBody.innerHTML =  
                `<tr><td colspan="4" style="text-align: center; color: gray;">No credit requests available</td></tr>`;
            return;
        }

        data.requests.forEach(request => {
            const row = document.createElement("tr");
            row.innerHTML = 
                `<td><input type="checkbox" class="request-checkbox" data-request-id="${request.id}"></td>
                <td>${request.userId}</td>
                <td>${request.creditsRequested}</td>
                <td>
                    <button class="accept-btn" onclick="acceptRequest('${request.id}')">✅ Accept</button>
                    <button class="reject-btn" onclick="rejectRequest('${request.id}')">❌ Reject</button>
                </td>`;
            requestTableBody.appendChild(row);
        });

        // Create buttons at the bottom of the table
        const buttonContainer = document.createElement('div');
        buttonContainer.classList.add('action-buttons');
        buttonContainer.innerHTML = 
            `<button class="reject-btn" onclick="rejectSelectedRequests()">Reject Selected</button>
            <button class="accept-btn" onclick="acceptSelectedRequests()">Accept Selected</button>`;
        document.getElementById("requestTableWrapper").appendChild(buttonContainer);
    })
    .catch(error => console.error("Error fetching credit requests:", error));
}

// Placeholder functions for accepting and rejecting individual requests
function acceptRequest(requestId) {
    alert(`Accepted request: ${requestId}`);
}

function rejectRequest(requestId) {
    alert(`Rejected request: ${requestId}`);
}

// Load files when page loads
document.addEventListener("DOMContentLoaded", loadFilesFromDB);

// Load users when page loads
document.addEventListener("DOMContentLoaded", loadUsersFromDB);

// Load credit requests when page loads
document.addEventListener("DOMContentLoaded", loadRequestsFromDB);
