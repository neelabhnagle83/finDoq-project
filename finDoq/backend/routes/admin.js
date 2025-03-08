const express = require('express');
const router = express.Router();
const { authenticateToken, isAdmin } = require('../middleware/auth');
const db = require('../config/database');

// Get all pending credit requests
router.get('/credit-requests', authenticateToken, isAdmin, (req, res) => {
    db.all(`
        SELECT cr.*, u.username 
        FROM credit_requests cr
        JOIN users u ON cr.userId = u.id
        WHERE cr.status = 'pending'
        ORDER BY cr.requestDate DESC`,
        (err, requests) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(requests);
        });
});

// Handle credit request (approve/reject)
router.put('/credit-requests/:id', authenticateToken, isAdmin, (req, res) => {
    const { status } = req.body;
    const { id } = req.params;
    
    if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }

    db.serialize(() => {
        if (status === 'approved') {
            db.run(`
                UPDATE users 
                SET credits = credits + (
                    SELECT requestedCredits 
                    FROM credit_requests 
                    WHERE id = ?
                )
                WHERE id = (
                    SELECT userId 
                    FROM credit_requests 
                    WHERE id = ?
                )`, [id, id]);
        }
        
        db.run('UPDATE credit_requests SET status = ? WHERE id = ?',
            [status, id],
            function(err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: `Request ${status}` });
            });
    });
});

// Get analytics data
router.get('/analytics', authenticateToken, isAdmin, (req, res) => {
    db.serialize(() => {
        const analytics = {};
        
        // Get total documents scanned today
        db.get(`
            SELECT COUNT(*) as todayScans 
            FROM documents 
            WHERE date(uploadDate) = date('now')`,
            (err, result) => {
                if (err) return res.status(500).json({ error: err.message });
                analytics.todayScans = result.todayScans;
                
                // Get top users by scan count
                db.all(`
                    SELECT u.username, COUNT(d.id) as scanCount
                    FROM users u
                    LEFT JOIN documents d ON u.id = d.userId
                    GROUP BY u.id
                    ORDER BY scanCount DESC
                    LIMIT 5`,
                    (err, users) => {
                        if (err) return res.status(500).json({ error: err.message });
                        analytics.topUsers = users;
                        
                        // Get credit usage stats
                        db.get(`
                            SELECT 
                                SUM(CASE WHEN credits < 5 THEN 1 ELSE 0 END) as lowCredits,
                                SUM(CASE WHEN credits >= 5 AND credits < 15 THEN 1 ELSE 0 END) as mediumCredits,
                                SUM(CASE WHEN credits >= 15 THEN 1 ELSE 0 END) as highCredits
                            FROM users`,
                            (err, creditStats) => {
                                if (err) return res.status(500).json({ error: err.message });
                                analytics.creditStats = creditStats;
                                res.json(analytics);
                            });
                    });
            });
    });
});

// Replace cleanup route with database clear route
router.post('/clear-files', authenticateToken, isAdmin, (req, res) => {
    db.run('DELETE FROM documents', function(err) {
        if (err) return res.status(500).json({ error: err.message });
        
        console.log(`Cleared ${this.changes} files from database`);
        res.json({
            message: `Successfully cleared ${this.changes} files from database`,
            deletedCount: this.changes
        });
    });
});

// Modify the files route to better handle unnamed files
router.get('/files', authenticateToken, isAdmin, (req, res) => {
    db.all(`
        SELECT 
            d.id,
            d.filename,
            d.content,
            d.uploadDate,
            u.username,
            CASE 
                WHEN d.filename LIKE '%-undefined%' THEN SUBSTR(d.filename, INSTR(d.filename, '-') + 1)
                WHEN d.filename LIKE '%-%' THEN SUBSTR(d.filename, INSTR(d.filename, '-') + 1)
                ELSE d.filename
            END as display_filename
        FROM documents d
        LEFT JOIN users u ON d.userId = u.id
        ORDER BY d.uploadDate DESC`,
        (err, files) => {
            if (err) return res.status(500).json({ error: err.message });
            
            // Clean up the filename display
            const cleanedFiles = files.map(file => ({
                ...file,
                filename: file.display_filename || file.filename,
                size: file.content ? file.content.length : 0
            }));
            
            res.json(cleanedFiles);
        });
});

router.get('/files/:id', authenticateToken, isAdmin, (req, res) => {
    db.get('SELECT * FROM documents WHERE id = ?', [req.params.id],
        (err, file) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!file) return res.status(404).json({ error: 'File not found' });
            res.json(file);
        });
});

router.get('/users', authenticateToken, isAdmin, (req, res) => {
    db.all(`
        SELECT 
            u.id,
            u.username,
            u.role,
            u.credits,
            u.lastCreditReset,
            COUNT(DISTINCT d.id) as documentsCount,
            CASE 
                WHEN u.credits > 0 THEN 'Active'
                ELSE 'No Credits'
            END as status
        FROM users u
        LEFT JOIN documents d ON u.id = d.userId
        GROUP BY u.id
        ORDER BY u.username`,
        (err, users) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(users);
        });
});

// Add user management endpoints
router.post('/users/:id/credits', authenticateToken, isAdmin, (req, res) => {
    const { credits } = req.body;
    db.run('UPDATE users SET credits = credits + ? WHERE id = ?',
        [credits, req.params.id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Credits updated successfully' });
        });
});

router.delete('/files/:id', authenticateToken, isAdmin, (req, res) => {
    db.run('DELETE FROM documents WHERE id = ?', [req.params.id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'File deleted successfully' });
        });
});

module.exports = router;
