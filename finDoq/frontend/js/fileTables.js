const fileTableBody = document.getElementById("fileTableBody");

// Array to hold uploaded files (initially empty)
let uploadedFiles = [];

// Function to update the file table with the uploaded files
function updateFileTable() {
    // Clear the table before adding rows
    fileTableBody.innerHTML = "";

    // Check if there are files uploaded
    if (uploadedFiles.length === 0) {
        // Show "No files uploaded" message if no files are uploaded
        const row = document.createElement("tr");
        row.innerHTML = `
            <td colspan="5" style="text-align: center; color: gray;">No files uploaded</td>
        `;
        fileTableBody.appendChild(row); // Append the "No files uploaded" message
    } else {
        // If files are present, create rows for each file
        uploadedFiles.forEach(file => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${file.name}</td>
                <td>${file.date}</td>
                <td>${file.size}</td>
                <td><button onclick="viewFile('${file.view}')">View</button></td>
                <td><button onclick="downloadFile('${file.download}')">Download</button></td>
            `;
            fileTableBody.appendChild(row); // Append each file's row
        });
    }
}

// Function to add new files dynamically to the uploadedFiles array and update the table
function addFileToTable(file) {
    if (file.type !== "text/plain") {
        alert("⚠️ Please upload only text files (.txt).");
        return;
    }

    const formData = new FormData();
    formData.append("file", file);
    const token = localStorage.getItem("token");

    fetch("http://localhost:3000/upload", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`,
        },
        body: formData,
    })
    .then(response => response.json())
    .then(data => {
        if (data && data.message === "File uploaded successfully.") {
            alert("✅ File uploaded successfully!");
            loadUploadedFiles(); // Reload the file list from the backend
        } else {
            alert("❌ File upload failed.");
        }
    })
    .catch(error => {
        console.error("Error uploading file:", error);
        alert("❌ File upload failed: " + error.message);
    });
}

// Function to handle file download
function downloadFile(downloadUrl) {
    const token = localStorage.getItem("token");
    fetch(`http://localhost:3000${downloadUrl}`, {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${token}`,
        },
    })
    .then((response) => response.blob())
    .then((blob) => {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = downloadUrl.split('/').pop();
        link.click();
    })
    .catch((error) => {
        console.error("Error downloading file:", error);
    });
}

// Function to view the uploaded file (you can implement this based on your needs)
function viewFile(viewUrl) {
    const token = localStorage.getItem("token");
    fetch(`http://localhost:3000${viewUrl}`, {
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

// Listen for file selection and trigger file upload
const browseBtn = document.querySelector(".browse-btn");

browseBtn.addEventListener("click", function () {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".txt"; // Accepted file types

    // When a file is selected, handle the upload
    fileInput.addEventListener("change", function () {
        const file = fileInput.files[0];
        if (file) {
            addFileToTable(file);  // Call function to add file to the table
        }
    });

    fileInput.click(); // Trigger file input click
});

function loadUploadedFiles() {
    const token = localStorage.getItem("token");
    fetch("http://localhost:3000/user/documents", {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    })
    .then((response) => response.json())
    .then((data) => {
        if (data && data.documents) {
            uploadedFiles = data.documents.map((doc) => ({
                name: doc.file_name,
                size: "N/A",
                date: "N/A",
                view: `/view/${doc.id}`,
                download: `/download/${doc.id}`,
            }));
            updateFileTable();
        }
    })
    .catch((error) => {
        console.error("Error loading uploaded files:", error);
    });
}

// Call loadUploadedFiles when the page loads
document.addEventListener("DOMContentLoaded", loadUploadedFiles);