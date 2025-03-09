const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { db } = require('../config/database');

const router = express.Router();

// Check credit balance
router.get('/balance', authenticateToken, (req, res) => {
    db.get('SELECT credits FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        res.json({ credits: user.credits });
    });
});

// Request additional credits
router.post('/request', authenticateToken, (req, res) => {
    const { amount, requestId } = req.body;
    
    if (!amount || amount <= 0) {
        return res.status(400).json({ error: 'Invalid credit amount' });
    }
    
    db.run('INSERT INTO credit_requests (userId, requestedCredits, requestDate) VALUES (?, ?, ?)',
        [req.user.id, amount, new Date().toISOString()],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            
            res.json({ 
                message: 'Credit request submitted successfully', 
                requestId: this.lastID,
                confirmed: true
            });
        });
});

// Implement daily reset of credits (should be called by a scheduled job)
router.post('/reset-daily', (req, res) => {
    const secretKey = req.headers['x-cron-key'];
    
    // Basic security to prevent unauthorized reset
    if (secretKey !== (process.env.CRON_SECRET || 'cron-secret-key')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Reset all users to 20 credits who haven't had a reset today
    const today = new Date().toISOString().split('T')[0];
    
    db.run(`
        UPDATE users 
        SET credits = 20, lastCreditReset = ? 
        WHERE date(lastCreditReset) < ? OR lastCreditReset IS NULL`,
        [today, today],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            
            res.json({ 
                message: 'Daily credit reset completed',
                usersUpdated: this.changes
            });
        });
});

// Deduct a credit (for document scans)
router.post('/deduct', authenticateToken, (req, res) => {
    db.get('SELECT credits FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        if (user.credits <= 0) {
            return res.status(403).json({ error: 'Insufficient credits' });
        }
        
        db.run('UPDATE users SET credits = credits - 1 WHERE id = ?',
            [req.user.id],
            function(err) {
                if (err) return res.status(500).json({ error: err.message });
                
                res.json({ 
                    message: 'Credit deducted successfully',
                    creditsRemaining: user.credits - 1
                });
            });
    });
});

module.exports = router;
