const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { db } = require('../config/database');
const crypto = require('crypto');

const router = express.Router();

// Get user's documents
router.get('/user', authenticateToken, (req, res) => {
    db.all('SELECT * FROM documents WHERE userId = ? ORDER BY uploadDate DESC', 
        [req.user.id], 
        (err, documents) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(documents);
        });
});

// Get recent documents
router.get('/recent', authenticateToken, (req, res) => {
    db.all('SELECT * FROM documents WHERE userId = ? ORDER BY uploadDate DESC LIMIT 5', 
        [req.user.id], 
        (err, documents) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(documents);
        });
});

// Add this new route to get a single document
router.get('/:id', authenticateToken, (req, res) => {
    db.get('SELECT * FROM documents WHERE id = ?', 
        [req.params.id], 
        (err, document) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!document) return res.status(404).json({ error: 'Document not found' });
            res.json(document);
        });
});

// Upload new document
router.post('/upload', authenticateToken, (req, res) => {
    const { filename, content, fileType } = req.body;
    
    // Generate a hash of the file content
    const contentHash = crypto
        .createHash('md5')
        .update(content || '')
        .digest('hex');
    
    console.log(`Processing upload: ${filename}, Hash: ${contentHash.substring(0, 8)}...`);
    
    // Improved duplicate check - check against ALL documents in the system
    db.get(
        'SELECT id, userId FROM documents WHERE contentHash = ?', 
        [contentHash], 
        (err, existingDoc) => {
            if (err) {
                console.error("Database error checking for duplicate:", err);
                return res.status(500).json({ error: 'Database error: ' + err.message });
            }
            
            // If exact content match found anywhere in the database
            if (existingDoc) {
                console.log(`Exact duplicate detected: Document ID ${existingDoc.id}`);
                
                // Return document ID but DO NOT create a new document
                return res.status(200).json({ 
                    status: 'duplicate',
                    message: 'This document already exists in the system',
                    documentId: existingDoc.id,
                    isDuplicate: true,
                    ownedByUser: existingDoc.userId === req.user.id
                });
            }
            
            // If not a duplicate, proceed with upload
            db.get('SELECT credits FROM users WHERE id = ?', [req.user.id], (err, user) => {
                if (err) return res.status(500).json({ error: err.message });
                if (!user) return res.status(404).json({ error: 'User not found' });
                
                if (user.credits <= 0) {
                    return res.status(403).json({ error: 'Insufficient credits for similarity scanning' });
                }
                
                // Validate file type
                const allowedTypes = ['text/plain', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ''];
                if (fileType && !allowedTypes.includes(fileType)) {
                    return res.status(400).json({ error: 'Unsupported file type. Please upload a .txt, .pdf, or .docx file.' });
                }
                
                // Deduct credit for the similarity scan
                db.run('UPDATE users SET credits = credits - 1 WHERE id = ?', [req.user.id], (err) => {
                    if (err) return res.status(500).json({ error: err.message });
                    
                    // Insert document with content hash
                    db.run('INSERT INTO documents (userId, filename, content, contentHash, uploadDate) VALUES (?, ?, ?, ?, ?)', 
                        [req.user.id, filename, content, contentHash, new Date().toISOString()], 
                        function(err) {
                            if (err) {
                                console.error("Error inserting document:", err);
                                return res.status(500).json({ error: 'Error inserting document: ' + err.message });
                            }
                            
                            const newDocId = this.lastID;
                            console.log(`Document uploaded successfully: Document ID ${newDocId}`);
                            
                            // Notify via WebSocket
                            if (global.notifyUser) {
                                global.notifyUser(req.user.id, {
                                    type: 'CREDIT_UPDATE',
                                    credits: user.credits - 1
                                });
                            }
                            
                            res.json({ 
                                message: 'Document uploaded and scanned for similarities',
                                documentId: newDocId,
                                creditsRemaining: user.credits - 1,
                                creditUsed: 1,
                                creditUsedFor: 'similarity scan'
                            });
                        });
                });
            });
        }
    );
});

module.exports = router;
