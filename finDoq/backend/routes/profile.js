const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const db = require('../config/database');

router.get('/', authenticateToken, (req, res) => {
    db.serialize(() => {
        // Get user profile with documents and credit requests
        const profile = {};
        
        db.get('SELECT username, credits FROM users WHERE id = ?', 
            [req.user.id], 
            (err, user) => {
                if (err) return res.status(500).json({ error: err.message });
                Object.assign(profile, user);

                // Get recent documents
                db.all(`SELECT * FROM documents 
                        WHERE userId = ? 
                        ORDER BY uploadDate DESC LIMIT 10`,
                    [req.user.id],
                    (err, documents) => {
                        if (err) return res.status(500).json({ error: err.message });
                        profile.documents = documents;

                        // Get credit requests
                        db.all(`SELECT * FROM credit_requests 
                                WHERE userId = ? 
                                ORDER BY requestDate DESC`,
                            [req.user.id],
                            (err, requests) => {
                                if (err) return res.status(500).json({ error: err.message });
                                profile.creditRequests = requests;
                                res.json(profile);
                            });
                    });
            });
    });
});

module.exports = router;
