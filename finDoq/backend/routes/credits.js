const express = require('express');
const router = express.Router();
const { authenticateToken, isAdmin } = require('../middleware/auth');
const db = require('../config/database');

// Request credits
router.post('/request', authenticateToken, (req, res) => {
    const { credits } = req.body;
    if (credits < 1 || credits > 10) {
        return res.status(400).json({ error: 'Invalid credit request amount' });
    }

    db.run('INSERT INTO credit_requests (userId, requestedCredits, requestDate) VALUES (?, ?, datetime("now"))',
        [req.user.id, credits],
        function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ message: 'Credit request submitted successfully' });
        });
});

// Daily credit reset
router.post('/reset-daily', (req, res) => {
    const secretKey = req.headers['cron-secret'];
    if (secretKey !== process.env.CRON_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    db.run(`UPDATE users SET 
            credits = CASE 
                WHEN strftime('%Y-%m-%d', lastCreditReset) != strftime('%Y-%m-%d', 'now') 
                THEN 20 
                ELSE credits 
            END,
            lastCreditReset = CASE 
                WHEN strftime('%Y-%m-%d', lastCreditReset) != strftime('%Y-%m-%d', 'now') 
                THEN datetime('now') 
                ELSE lastCreditReset 
            END`,
        function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ message: 'Daily credits reset completed' });
        });
});

router.put('/credit-requests/:id', authenticateToken, isAdmin, (req, res) => {
    const { status } = req.body;
    const { id } = req.params;

    db.get('SELECT userId, requestedCredits FROM credit_requests WHERE id = ?', [id],
        (err, request) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!request) return res.status(404).json({ error: 'Request not found' });

            if (status === 'approved') {
                db.run('UPDATE users SET credits = credits + ? WHERE id = ?',
                    [request.requestedCredits, request.userId],
                    (err) => {
                        if (err) return res.status(500).json({ error: err.message });
                        
                        // Notify user via WebSocket
                        global.notifyUser(request.userId, {
                            type: 'creditUpdate',
                            message: `Your credit request for ${request.requestedCredits} credits was approved`
                        });
                    });
            }
            // ...existing code...
        });
});

module.exports = router;
