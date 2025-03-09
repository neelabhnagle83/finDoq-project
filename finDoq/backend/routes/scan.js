const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { db } = require('../config/database');
const fs = require('fs');
const path = require('path');

const router = express.Router();

router.post('/upload', authenticateToken, (req, res) => {
    const { filename, content } = req.body;

    db.run('INSERT INTO documents (userId, filename, content, uploadDate) VALUES (?, ?, ?, ?)', [req.user.id, filename, content, new Date().toISOString()], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Document uploaded successfully', documentId: this.lastID });
    });
});

router.get('/matches/:docId', authenticateToken, (req, res) => {
    const { docId } = req.params;
    
    console.log(`Scanning for matches for document ID: ${docId}`);

    // First get the document content
    db.get('SELECT content, filename, userId FROM documents WHERE id = ?', [docId], (err, doc) => {
        if (err) {
            console.error("Error getting document:", err);
            return res.status(500).json({ error: err.message });
        }
        
        if (!doc) {
            return res.status(404).json({ error: 'Document not found' });
        }

        // Get all other documents
        db.all('SELECT id, filename, content, userId FROM documents WHERE id != ?', 
            [docId], 
            (err, docs) => {
                if (err) {
                    console.error("Error getting other documents:", err);
                    return res.status(500).json({ error: err.message });
                }

                console.log(`Comparing document ${docId} against ${docs.length} other documents`);
                
                // Parse the source document into words for better comparison
                const sourceWords = doc.content
                    .toLowerCase()
                    .replace(/[^\w\s]/g, '')
                    .split(/\s+/)
                    .filter(word => word.length > 2);
                
                // Use a lower threshold to catch more similarities
                const similarityThreshold = 0.03; // Lower from 0.05 to 0.03 (3%)
                const matches = [];
                
                // Process each document for similarity
                docs.forEach(otherDoc => {
                    // Only compare if document has content
                    if (!otherDoc.content) return;
                    
                    const otherWords = otherDoc.content
                        .toLowerCase()
                        .replace(/[^\w\s]/g, '')
                        .split(/\s+/)
                        .filter(word => word.length > 2);
                    
                    // Find common words
                    const commonWords = sourceWords.filter(word => otherWords.includes(word));
                    
                    // Calculate Jaccard similarity coefficient
                    const union = new Set([...sourceWords, ...otherWords]).size;
                    const similarity = union === 0 ? 0 : commonWords.length / union;
                    
                    console.log(`Document ${otherDoc.id}: ${commonWords.length} common words, similarity score: ${similarity.toFixed(3)}`);
                    
                    // If similarity is above threshold, add to matches
                    if (similarity >= similarityThreshold) {
                        matches.push({
                            id: otherDoc.id,
                            filename: otherDoc.filename,
                            similarity: similarity,
                            commonWords: commonWords.length,
                            uploadedBy: otherDoc.userId
                        });
                    }
                });
                
                // Sort by similarity (highest first)
                matches.sort((a, b) => b.similarity - a.similarity);
                
                console.log(`Found ${matches.length} matches with similarity ≥ ${similarityThreshold * 100}%`);
                res.json({ matches });
            }
        );
    });
});

module.exports = router;
