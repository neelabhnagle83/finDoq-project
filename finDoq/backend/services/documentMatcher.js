class DocumentMatcher {
    static analyzeDocument(text) {
        return {
            wordCount: text.split(/\W+/).length,
            uniqueWords: new Set(text.toLowerCase().split(/\W+/)),
            keyPhrases: this.extractKeyPhrases(text),
            sentiments: this.analyzeSentiment(text)
        };
    }

    static calculateSimilarity(doc1, doc2) {
        // Normalize the texts
        const text1 = this.normalizeText(doc1);
        const text2 = this.normalizeText(doc2);

        // For very short texts, use a more precise comparison
        if (text1.length < 100 || text2.length < 100) {
            return this.calculateExactSimilarity(text1, text2);
        }

        // Create word sets for comparison
        const words1 = new Set(text1.split(/\s+/).filter(w => w.length > 3));
        const words2 = new Set(text2.split(/\s+/).filter(w => w.length > 3));

        // Find intersection of word sets
        const intersection = new Set([...words1].filter(x => words2.has(x)));
        
        // Calculate similarity using Jaccard index with length adjustment
        const smallerSize = Math.min(words1.size, words2.size);
        const largerSize = Math.max(words1.size, words2.size);
        
        // Apply length scaling to avoid small documents getting artificially high scores
        const lengthScalingFactor = Math.pow(smallerSize / Math.max(largerSize, 1), 0.3);
        
        // Calculate base similarity
        let similarity = 0;
        if (smallerSize > 0) {
            // Calculate Jaccard similarity
            similarity = (intersection.size / largerSize) * 100;
            // Apply length scaling factor
            similarity = similarity * lengthScalingFactor;
        }
        
        // Ensure the result is between 0-100
        return Math.min(Math.max(Math.round(similarity), 0), 100);
    }

    static calculateExactSimilarity(text1, text2) {
        // For short texts, use Levenshtein distance
        const distance = this.levenshteinDistance(text1, text2);
        const maxLength = Math.max(text1.length, text2.length);
        
        if (maxLength === 0) return 100; // Both empty strings
        
        // Convert distance to similarity percentage
        const similarity = 100 * (1 - distance / maxLength);
        return Math.round(similarity);
    }
    
    static levenshteinDistance(s1, s2) {
        const len1 = s1.length;
        const len2 = s2.length;
        
        // Matrix to store distances
        let matrix = Array(len1 + 1).fill().map(() => Array(len2 + 1).fill(0));
        
        // Initialize first row and column
        for (let i = 0; i <= len1; i++) matrix[i][0] = i;
        for (let j = 0; j <= len2; j++) matrix[0][j] = j;
        
        // Fill the matrix
        for (let i = 1; i <= len1; i++) {
            for (let j = 1; j <= len2; j++) {
                const cost = s1[i-1] === s2[j-1] ? 0 : 1;
                matrix[i][j] = Math.min(
                    matrix[i-1][j] + 1,       // deletion
                    matrix[i][j-1] + 1,       // insertion
                    matrix[i-1][j-1] + cost   // substitution
                );
            }
        }
        
        return matrix[len1][len2];
    }
    
    static normalizeText(text) {
        return text
            .toLowerCase()
            .replace(/[^\w\s]/g, '') // Remove punctuation
            .replace(/\s+/g, ' ')    // Normalize whitespace
            .trim();                 // Remove leading/trailing whitespace
    }

    static calculateWordSimilarity(words1, words2) {
        const set1 = new Set(words1);
        const set2 = new Set(words2);
        const intersection = new Set(words1.filter(x => set2.has(x)));
        const totalUnique = new Set([...words1, ...words2]);
        
        // Give more weight to exact matches
        return intersection.size / totalUnique.size;
    }

    static calculatePhraseSimilarity(words1, words2) {
        const phrases1 = this.getNGrams(words1, 3);
        const phrases2 = this.getNGrams(words2, 3);
        const commonPhrases = phrases1.filter(p => phrases2.includes(p));
        return commonPhrases.length / Math.max(phrases1.length, phrases2.length);
    }

    static getNGrams(words, n) {
        const phrases = [];
        for (let i = 0; i <= words.length - n; i++) {
            phrases.push(words.slice(i, i + n).join(' '));
        }
        return phrases;
    }

    static calculateLengthSimilarity(words1, words2) {
        const maxLen = Math.max(words1.length, words2.length);
        const minLen = Math.min(words1.length, words2.length);
        return minLen / maxLen;
    }

    static extractKeyPhrases(text) {
        // Advanced key phrase extraction
        const sentences = text.split(/[.!?]+/);
        return sentences.map(sentence => {
            const words = sentence.trim().split(/\W+/);
            return words.filter(word => word.length > 3).slice(0, 3);
        }).flat();
    }

    static analyzeSentiment(text) {
        // Basic sentiment analysis
        const positiveWords = new Set(['good', 'great', 'excellent', 'positive', 'success']);
        const negativeWords = new Set(['bad', 'poor', 'negative', 'failure', 'wrong']);
        
        const words = text.toLowerCase().split(/\W+/);
        let score = 0;
        
        words.forEach(word => {
            if (positiveWords.has(word)) score++;
            if (negativeWords.has(word)) score--;
        });

        return score;
    }

    static compareSentiments(sentiment1, sentiment2) {
        // Convert sentiment scores to normalized values
        const norm1 = Math.tanh(sentiment1);
        const norm2 = Math.tanh(sentiment2);
        return 1 - Math.abs(norm1 - norm2) / 2;
    }
}

module.exports = DocumentMatcher;
