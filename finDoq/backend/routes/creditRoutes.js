const express = require("express");
const { authenticateToken } = require("../middleware/authMiddleware");
const db = require("../db");
const router = express.Router();

// Request more credits
router.post("/request", authenticateToken, (req, res) => {
    const userId = req.user.userId;
    const { creditsRequested } = req.body;

    if (creditsRequested < 0 || creditsRequested > 10) {
        return res.status(400).json({ error: "Requested credits should be between 0 and 10." });
    }

    db.run("INSERT INTO credit_requests (user_id, creditsRequested) VALUES (?, ?)", [userId, creditsRequested], function (err) {
        if (err) {
            return res.status(500).json({ error: "Database error while requesting credits" });
        }
        res.json({ message: "Credit request submitted successfully" });
    });
});

// Approve or deny credit requests (Admin only)
router.post("/approve", authenticateToken, (req, res) => {
    if (req.user.role !== "admin") {
        return res.status(403).json({ error: "Access denied. Admins only." });
    }

    const { requestId, approve } = req.body;

    db.get("SELECT * FROM credit_requests WHERE id = ?", [requestId], (err, request) => {
        if (err) {
            return res.status(500).json({ error: "Database error while fetching credit request" });
        }
        if (!request) {
            return res.status(404).json({ error: "Credit request not found" });
        }

        if (approve) {
            db.run("UPDATE users SET credits = credits + ? WHERE id = ?", [request.creditsRequested, request.user_id], (err) => {
                if (err) {
                    return res.status(500).json({ error: "Database error while updating user credits" });
                }
                db.run("UPDATE credit_requests SET status = 'approved' WHERE id = ?", [requestId], (err) => {
                    if (err) {
                        return res.status(500).json({ error: "Database error while updating credit request status" });
                    }
                    res.json({ message: "Credit request approved" });
                });
            });
        } else {
            db.run("UPDATE credit_requests SET status = 'denied' WHERE id = ?", [requestId], (err) => {
                if (err) {
                    return res.status(500).json({ error: "Database error while updating credit request status" });
                }
                res.json({ message: "Credit request denied" });
            });
        }
    });
});

module.exports = router;