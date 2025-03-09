class FileTableHandler {
    static updateTable(files) {
        const tbody = document.getElementById('fileTableBody');
        if (!tbody || !files?.length) return;

        tbody.innerHTML = files
            .map(file => `
                <tr>
                    <td>${file.filename}</td>
                    <td>${file.uploadDate}</td>
                    <td><button onclick="window.dashboard.viewFile(${file.id})">View</button></td>
                    <td><button onclick="window.dashboard.downloadFile(${file.id})">Download</button></td>
                </tr>
            `).join('');
    }
}

window.FileTableHandler = FileTableHandler;
