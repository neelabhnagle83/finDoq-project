export function uploadFile(file) {
    const token = localStorage.getItem("token");
    const userId = localStorage.getItem("userId");

    if (!file) {
        alert("⚠️ No file selected! Please choose a file before uploading.");
        return;
    }

    if (file.type !== "text/plain") {
        alert("⚠️ Please upload only text files (.txt).");
        return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("userId", userId);

    console.log("Uploading file...");

    fetch("http://localhost:3000/upload", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`,
        },
        body: formData,
    })
    .then(async (response) => {
        const data = await response.json();
        console.log("Server Response:", data);

        if (!response.ok) {
            throw new Error(data.error || "File upload failed.");
        }

        alert("File uploaded successfully")
    })
    .catch((error) => {
        console.error("Error uploading file:", error);
        alert("❌ File upload failed: " + error.message);
    });
}
