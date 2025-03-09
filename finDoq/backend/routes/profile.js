const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { db } = require('../config/database');

const router = express.Router();

router.get('/', authenticateToken, (req, res) => {
    db.serialize(() => {
        const profile = {};

        db.get('SELECT username, credits FROM users WHERE id = ?', [req.user.id], (err, user) => {
            if (err) return res.status(500).json({ error: err.message });
            Object.assign(profile, user);

            db.all('SELECT * FROM documents WHERE userId = ? ORDER BY uploadDate DESC LIMIT 10', [req.user.id], (err, documents) => {
                if (err) return res.status(500).json({ error: err.message });
                profile.documents = documents;

                db.all('SELECT * FROM credit_requests WHERE userId = ? ORDER BY requestDate DESC', [req.user.id], (err, requests) => {
                    if (err) return res.status(500).json({ error: err.message });
                    profile.creditRequests = requests;
                    res.json(profile);
                });
            });
        });
    });
});

module.exports = router;
