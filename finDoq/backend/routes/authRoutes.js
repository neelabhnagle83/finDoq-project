const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");
const router = express.Router();
const SECRET_KEY = "finDoq@098"; // Match this with server.js for consistency

// Signup Route (Regular Users Only)
router.post("/signup", (req, res) => {
    const { username, password } = req.body;

    if (username.toLowerCase() === "admin") {
        return res.status(403).json({ error: "You cannot register as an admin." });
    }

    // Check if username already exists
    db.get("SELECT * FROM users WHERE username = ?", [username], (err, row) => {
        if (err) {
            console.error("❌ Database error during signup:", err.message);
            return res.status(500).json({ error: "Database error during signup" });
        }
        if (row) {
            return res.status(400).json({ error: "Username already exists!" });
        }

        // Hash password and insert new user with default credits (20)
        const hashedPassword = bcrypt.hashSync(password, 10);
        db.run(
            "INSERT INTO users (username, password, role, credits) VALUES (?, ?, 'user', 20)",
            [username, hashedPassword],
            function (err) {
                if (err) {
                    console.error("❌ Error inserting user:", err.message);
                    return res.status(500).json({ error: "Failed to register user" });
                }
                res.status(201).json({ message: "User registered successfully", id: this.lastID });
            }
        );
    });
});

// Login Route
router.post("/login", (req, res) => {
    const { username, password } = req.body;

    db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
        if (err) {
            console.error("❌ Database error during login:", err.message);
            return res.status(500).json({ error: "Database error during login" });
        }
        if (!user) return res.status(401).json({ error: "User not found" });

        if (bcrypt.compareSync(password, user.password)) {
            const token = jwt.sign({ userId: user.id, username: user.username, role: user.role }, SECRET_KEY, { expiresIn: '24h' });
            res.json({ token, role: user.role, message: "Logged in successfully!" });
        } else {
            res.status(401).json({ error: "Invalid password" });
        }
    });
});

module.exports = router;