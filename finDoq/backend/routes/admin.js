const express = require('express');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const { db } = require('../config/database');

const router = express.Router();

router.get('/credit-requests', authenticateToken, isAdmin, (req, res) => {
    db.all('SELECT cr.*, u.username FROM credit_requests cr JOIN users u ON cr.userId = u.id WHERE cr.status = "pending" ORDER BY cr.requestDate DESC', (err, requests) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(requests);
    });
});

router.put('/credit-requests/:id', authenticateToken, isAdmin, (req, res) => {
    const { status } = req.body;
    const { id } = req.params;

    if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }

    db.serialize(() => {
        if (status === 'approved') {
            db.run('UPDATE users SET credits = credits + (SELECT requestedCredits FROM credit_requests WHERE id = ?) WHERE id = (SELECT userId FROM credit_requests WHERE id = ?)', [id, id]);
        }

        db.run('UPDATE credit_requests SET status = ? WHERE id = ?', [status, id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: `Request ${status}` });
        });
    });
});

router.get('/analytics', authenticateToken, isAdmin, (req, res) => {
    db.serialize(() => {
        const analytics = {};

        db.get('SELECT COUNT(*) as todayScans FROM documents WHERE date(uploadDate) = date("now")', (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            analytics.todayScans = result.todayScans;

            db.all('SELECT u.username, COUNT(d.id) as scanCount FROM users u LEFT JOIN documents d ON u.id = d.userId GROUP BY u.id ORDER BY scanCount DESC LIMIT 5', (err, users) => {
                if (err) return res.status(500).json({ error: err.message });
                analytics.topUsers = users;

                // Add document topic analysis
                db.all('SELECT content FROM documents', (err, docs) => {
                    if (err) return res.status(500).json({ error: err.message });
                    
                    // Extract topics from documents
                    const topics = extractTopics(docs);
                    analytics.commonTopics = topics;
                    
                    db.get('SELECT SUM(CASE WHEN credits < 5 THEN 1 ELSE 0 END) as lowCredits, SUM(CASE WHEN credits >= 5 AND credits < 15 THEN 1 ELSE 0 END) as mediumCredits, SUM(CASE WHEN credits >= 15 THEN 1 ELSE 0 END) as highCredits FROM users', (err, creditStats) => {
                        if (err) return res.status(500).json({ error: err.message });
                        analytics.creditStats = creditStats;
                        res.json(analytics);
                    });
                });
            });
        });
    });
});

// Extract common topics from documents
function extractTopics(documents) {
    // Word frequency analysis
    const wordFreq = {};
    const stopWords = new Set(['the', 'and', 'is', 'in', 'it', 'to', 'a', 'of', 'for', 'with', 'on', 'this', 'that']);
    
    documents.forEach(doc => {
        if (!doc.content) return;
        
        const words = doc.content.toLowerCase()
            .replace(/[^\w\s]/g, '')
            .split(/\s+/)
            .filter(word => word.length > 3 && !stopWords.has(word));
            
        words.forEach(word => {
            wordFreq[word] = (wordFreq[word] || 0) + 1;
        });
    });
    
    // Convert to array, sort by frequency
    const topics = Object.entries(wordFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([word, count]) => ({ topic: word, count }));
        
    return topics;
}

router.post('/clear-files', authenticateToken, isAdmin, (req, res) => {
    db.run('DELETE FROM documents', function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: `Successfully cleared ${this.changes} files from database`, deletedCount: this.changes });
    });
});

router.get('/files', authenticateToken, isAdmin, (req, res) => {
    db.all('SELECT d.id, d.filename, d.content, d.uploadDate, u.username FROM documents d JOIN users u ON d.userId = u.id ORDER BY d.uploadDate DESC', (err, files) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(files);
    });
});

router.delete('/files/:id', authenticateToken, isAdmin, (req, res) => {
    db.run('DELETE FROM documents WHERE id = ?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'File deleted successfully' });
    });
});

router.post('/users/:id/credits', authenticateToken, isAdmin, (req, res) => {
    const { credits } = req.body;
    db.run('UPDATE users SET credits = credits + ? WHERE id = ?', [credits, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Credits updated successfully' });
    });
});

router.get('/users', authenticateToken, isAdmin, (req, res) => {
    db.all('SELECT u.id, u.username, u.role, u.credits, u.lastCreditReset, COUNT(DISTINCT d.id) as documentsCount, CASE WHEN u.credits > 0 THEN "Active" ELSE "No Credits" END as status FROM users u LEFT JOIN documents d ON u.id = d.userId GROUP BY u.id ORDER BY u.username', (err, users) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(users);
    });
});

module.exports = router;
