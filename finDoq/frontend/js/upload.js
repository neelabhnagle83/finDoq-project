export function uploadFile(file) {
    const token = localStorage.getItem("token");
    const userId = localStorage.getItem("userId");
    const username = localStorage.getItem("username");

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

    fetch("http://localhost:3000/upload", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`,
        },
        body: formData,
    })
    .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || "File upload failed.");
        }

        const scanUrl = `http://localhost:3000/scan/${data.documentId}`;
        await fetch(scanUrl, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ username: username })
        });

        alert("✅ File uploaded and scanned successfully!");
    })
    .catch((error) => {
        console.error("Error:", error);
        alert("❌ " + error.message);
    });
}
