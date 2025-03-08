const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticateToken } = require('../middleware/auth');
const db = require('../config/database');
const DocumentMatcher = require('../services/documentMatcher');

// Custom storage configuration
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => {
        // Keep original name but add timestamp to prevent conflicts
        const timestamp = Date.now();
        const originalName = file.originalname;
        cb(null, `${timestamp}-${originalName}`);
    }
});

const upload = multer({ storage: storage });

// Custom similarity calculation algorithm
function calculateDocumentSimilarity(doc1, doc2) {
    const words1 = new Set(doc1.toLowerCase().split(/\W+/));
    const words2 = new Set(doc2.toLowerCase().split(/\W+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    // Custom weighted similarity score
    const commonWordWeight = 0.6;
    const lengthSimilarityWeight = 0.4;
    
    const wordSimilarity = intersection.size / union.size;
    const lengthSimilarity = 1 - Math.abs(words1.size - words2.size) / Math.max(words1.size, words2.size);
    
    return (wordSimilarity * commonWordWeight + lengthSimilarity * lengthSimilarityWeight) * 100;
}

// Upload and scan document
router.post('/scan', authenticateToken, upload.single('document'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const fs = require('fs').promises;
    try {
        const content = await fs.readFile(req.file.path, { encoding: 'utf8' });
        
        // Always deduct credit for scan
        db.run('UPDATE users SET credits = credits - 1 WHERE id = ? AND credits > 0',
            [req.user.id]);

        // Get all documents including user's own
        db.all(`SELECT d.*, u.username 
               FROM documents d 
               JOIN users u ON d.userId = u.id`, 
            async (err, documents) => {
                if (err) return res.status(500).json({ error: err.message });

                // Calculate similarities
                const similarities = documents.map(doc => {
                    const displayName = doc.filename.includes('-') ? 
                        doc.filename.split('-').slice(1).join('-') : 
                        doc.filename;
                        
                    return {
                        documentId: doc.id,
                        filename: displayName,
                        username: doc.username,
                        content: doc.content.substring(0, 100) + '...',  // Preview only
                        similarity: DocumentMatcher.calculateSimilarity(content, doc.content)
                    };
                })
                .filter(result => result.similarity > 5)  // Show more matches
                .sort((a, b) => b.similarity - a.similarity);

                // Store document if doesn't exist
                db.get(`SELECT * FROM documents WHERE userId = ? AND content = ? LIMIT 1`,
                    [req.user.id, content],
                    (err, existingDoc) => {
                        if (err) return res.status(500).json({ error: err.message });
                        
                        if (!existingDoc) {
                            db.run(`INSERT INTO documents (userId, filename, content, uploadDate) 
                                   VALUES (?, ?, ?, datetime('now'))`,
                                [req.user.id, req.file.originalname, content]);
                        }

                        res.json({
                            message: similarities.length > 0 ? 'Similar documents found' : 'No similar documents found',
                            similarities,
                            isExisting: !!existingDoc
                        });
                    });
            });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add upload-only route without scanning
router.post('/upload', authenticateToken, upload.single('document'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const fs = require('fs').promises;
    try {
        const content = await fs.readFile(req.file.path, 'utf8');
        
        // Check for duplicate before uploading
        db.get('SELECT * FROM documents WHERE userId = ? AND content = ?',
            [req.user.id, content],
            (err, existingDoc) => {
                if (err) return res.status(500).json({ error: err.message });
                if (existingDoc) {
                    return res.status(400).json({ error: 'File already exists' });
                }

                // Store document if not duplicate
                db.run('INSERT INTO documents (userId, filename, content, uploadDate) VALUES (?, ?, ?, datetime("now"))',
                    [req.user.id, req.file.originalname, content],
                    function(err) {
                        if (err) return res.status(500).json({ error: err.message });
                        res.json({ 
                            message: 'Document uploaded successfully',
                            documentId: this.lastID
                        });
                    });
            });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add view and download routes
router.get('/:id', authenticateToken, (req, res) => {
    db.get('SELECT * FROM documents WHERE id = ? AND userId = ?', 
        [req.params.id, req.user.id],
        (err, document) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!document) return res.status(404).json({ error: 'Document not found' });
            res.json(document);
        });
});

router.get('/:id/download', authenticateToken, (req, res) => {
    db.get('SELECT * FROM documents WHERE id = ? AND userId = ?', 
        [req.params.id, req.user.id],
        (err, document) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!document) return res.status(404).json({ error: 'Document not found' });
            
            res.setHeader('Content-Type', 'text/plain');
            res.setHeader('Content-Disposition', `attachment; filename="${document.filename}"`);
            res.send(document.content);
        });
});

// Get recent files
router.get('/recent', authenticateToken, (req, res) => {
    db.all(`
        SELECT * FROM documents 
        WHERE userId = ? 
        ORDER BY uploadDate DESC 
        LIMIT 10`,
        [req.user.id],
        (err, files) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(files);
        });
});

router.post('/check-duplicate', authenticateToken, async (req, res) => {
    const { filename, content } = req.body;
    
    db.get(`SELECT * FROM documents 
            WHERE userId = ? 
            AND (filename = ? OR content = ?)`, 
        [req.user.id, filename, content],
        (err, doc) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ isDuplicate: !!doc });
        });
});

// Add route to get similarities without uploading
router.post('/similarities', authenticateToken, async (req, res) => {
    const { content } = req.body;
    
    db.all(`SELECT d.*, u.username 
            FROM documents d 
            JOIN users u ON d.userId = u.id 
            WHERE d.userId != ?`, 
        [req.user.id],
        (err, documents) => {
            if (err) return res.status(500).json({ error: err.message });
            
            const similarities = documents
                .map(doc => ({
                    documentId: doc.id,
                    filename: doc.filename,
                    username: doc.username,
                    similarity: DocumentMatcher.calculateSimilarity(content, doc.content)
                }))
                .filter(result => result.similarity > 20)
                .sort((a, b) => b.similarity - a.similarity);
            
            res.json({ similarities });
        });
});

module.exports = router;
