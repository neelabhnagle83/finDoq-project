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

    // Load relevant data based on section
    switch(sectionId) {
        case 'files':
            loadFilesFromDB();
            break;
        case 'users':
            loadUsersFromDB();
            break;
        case 'notifications':  // Changed from 'credits' to 'notifications' to match HTML
            loadRequestsFromDB();
            break;
    }
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
function viewFile(fileId) {
    const token = localStorage.getItem("token");
    fetch(`http://localhost:3000/view/${fileId}`, { // Modified this line
        method: "GET",
        headers: {
            "Authorization": `Bearer ${token}`,
        },
    })
    .then((response) => response.text())
    .then((text) => {
        const newTab = window.open();
        newTab.document.open();
        newTab.document.write('<pre>' + text + '</pre>');
        newTab.document.close();
    })
    .catch((error) => {
        console.error("Error viewing file:", error);
    });
}

function downloadFile(fileId) {
    const token = localStorage.getItem("token");
    fetch(`http://localhost:3000/download/${fileId}`, { // Modified this line
        method: "GET",
        headers: {
            "Authorization": `Bearer ${token}`,
        },
    })
    .then((response) => response.blob())
    .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileId;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    })
    .catch((error) => {
        console.error("Error downloading file:", error);
    });
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

        const uniqueUsers = removeDuplicateUsers(data.users);
        uniqueUsers.forEach(user => {
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

// Function to remove duplicate users based on user ID
function removeDuplicateUsers(users) {
    const uniqueUsers = [];
    const userIds = new Set();

    users.forEach(user => {
        if (!userIds.has(user.id)) {
            uniqueUsers.push(user);
            userIds.add(user.id);
        }
    });

    return uniqueUsers;
}

// Function to toggle all checkboxes when "Select All" is clicked for credit requests
function toggleSelectAllRequests(selectAllCheckbox) {
    const checkboxes = document.querySelectorAll('.request-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.checked = selectAllCheckbox.checked;
    });
}

// Function to accept selected credit requests
function acceptSelectedRequests() {
    const checkboxes = document.querySelectorAll('.request-checkbox:checked');
    
    if (checkboxes.length === 0) {
        alert("⚠️ Please select at least one request to accept.");
        return;
    }

    const confirmed = confirm("Are you sure you want to accept the selected credit requests?");
    if (!confirmed) return;

    let acceptedCount = 0;
    let errorOccurred = false;
    const token = localStorage.getItem("token");

    const acceptRequest = (requestId, row) => {
        return fetch(`http://localhost:3000/admin/credit-requests/${requestId}/accept`, {
            method: "POST",
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
            console.log(`Client: Credit request ${requestId} accepted:`, data.message);
            acceptedCount++;
            row.remove(); // Remove the row from the table upon successful acceptance
        })
        .catch(error => {
            console.error(`Client: Fetch error for credit request ID ${requestId}:`, error);
            errorOccurred = true;
        });
    };

    const acceptPromises = Array.from(checkboxes).map(checkbox => {
        const requestId = checkbox.getAttribute("data-request-id");
        const row = checkbox.closest("tr");
        return acceptRequest(requestId, row);
    });

    Promise.allSettled(acceptPromises).then(() => {
        if (errorOccurred) {
            alert("⚠️ Some errors occurred while accepting credit requests. Please check the console.");
        } else {
            alert("✅ Selected credit requests have been accepted.");
        }
    });
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

    let rejectedCount = 0;
    let errorOccurred = false;
    const token = localStorage.getItem("token");

    const rejectRequest = (requestId, row) => {
        return fetch(`http://localhost:3000/admin/credit-requests/${requestId}/reject`, {
            method: "POST",
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
            console.log(`Client: Credit request ${requestId} rejected:`, data.message);
            rejectedCount++;
            row.remove(); // Remove the row from the table upon successful rejection
        })
        .catch(error => {
            console.error(`Client: Fetch error for credit request ID ${requestId}:`, error);
            errorOccurred = true;
        });
    };

    const rejectPromises = Array.from(checkboxes).map(checkbox => {
        const requestId = checkbox.getAttribute("data-request-id");
        const row = checkbox.closest("tr");
        return rejectRequest(requestId, row);
    });

    Promise.allSettled(rejectPromises).then(() => {
        if (errorOccurred) {
            alert("⚠️ Some errors occurred while rejecting credit requests. Please check the console.");
        } else {
            alert("✅ Selected credit requests have been rejected.");
        }
    });
}

// Placeholder functions for accepting and rejecting individual requests
function acceptRequest(requestId) {
    const token = localStorage.getItem("token");
    fetch(`http://localhost:3000/admin/credit-requests/${requestId}/accept`, {
        method: "POST",
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
        alert(data.message);
        loadRequestsFromDB(); // Reload credit requests after accepting
    })
    .catch(error => {
        console.error("Error accepting credit request:", error);
        alert("⚠️ An error occurred while accepting the credit request.");
    });
}

function rejectRequest(requestId) {
    const token = localStorage.getItem("token");
    fetch(`http://localhost:3000/admin/credit-requests/${requestId}/reject`, {
        method: "POST",
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
        alert(data.message);
        loadRequestsFromDB(); // Reload credit requests after rejecting
    })
    .catch(error => {
        console.error("Error rejecting credit request:", error);
        alert("⚠️ An error occurred while rejecting the credit request.");
    });
}

// Function to load credit requests from the database
function loadRequestsFromDB() {
    const tableBody = document.getElementById("notificationTableBody");
    if (!tableBody) {
        console.error("notificationTableBody element not found in DOM.");
        return;
    }
    tableBody.innerHTML = "";

    const token = localStorage.getItem("token");
    fetch("http://localhost:3000/admin/credit-requests", {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${token}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log("Credit requests data:", data);
        
        // Filter to show only pending requests
        const pendingRequests = data.requests.filter(r => r.status === 'pending');
        
        if (!pendingRequests || pendingRequests.length === 0) {
            tableBody.innerHTML = 
                `<tr><td colspan="4" style="text-align: center; color: gray;">No pending credit requests</td></tr>`;
            return;
        }

        pendingRequests.forEach(request => {
            const row = document.createElement("tr");
            row.innerHTML = 
                `<td><input type="checkbox" class="request-checkbox" data-request-id="${request.id}"></td>
                <td>${request.username}</td>
                <td>${request.creditsRequested}</td>
                <td>
                    <button class="accept-btn" onclick="acceptRequest('${request.id}')">✅ Accept</button>
                    <button class="reject-btn" onclick="rejectRequest('${request.id}')">❌ Reject</button>
                </td>`;
            tableBody.appendChild(row);
        });
    })
    .catch(error => {
        console.error("Error fetching credit requests:", error);
        tableBody.innerHTML = 
            `<tr><td colspan="4" style="text-align: center; color: red;">Error loading credit requests</td></tr>`;
    });
}

// Load files when page loads
document.addEventListener("DOMContentLoaded", () => {
    // Load initial section based on URL hash or default to files
    const initialSection = window.location.hash.slice(1) || 'files';
    showSection(initialSection);
});
