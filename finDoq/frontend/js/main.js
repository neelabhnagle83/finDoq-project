// Function to load components dynamically
function loadComponent(id, file) {
    fetch(file)
        .then(response => response.text())
        .then(data => {
            document.getElementById(id).innerHTML = data;
        })
        .catch(error => console.error(`Error loading ${file}:`, error));
}

// Load Navbar & Footer on all pages
document.addEventListener("DOMContentLoaded", () => {
    loadComponent("navbar", "../components/navbar.html");
    loadComponent("footer", "../components/footer.html");
});
