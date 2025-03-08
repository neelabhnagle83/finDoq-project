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
        if (!doc1 || !doc2) return 0;

        // Normalize content
        const content1 = doc1.toLowerCase().trim();
        const content2 = doc2.toLowerCase().trim();

        // Handle exact matches first
        if (content1 === content2) return 100;

        // Split into words and filter empty strings
        const words1 = content1.split(/\s+/).filter(w => w.length > 0);
        const words2 = content2.split(/\s+/).filter(w => w.length > 0);

        if (words1.length === 0 || words2.length === 0) return 0;

        // Get unique words
        const set1 = new Set(words1);
        const set2 = new Set(words2);

        // Calculate intersection
        const intersection = new Set([...set1].filter(x => set2.has(x)));

        // Calculate similarity score with size bias
        const smallerSize = Math.min(set1.size, set2.size);
        const largerSize = Math.max(set1.size, set2.size);
        const matchScore = (intersection.size / smallerSize) * 100;

        // Apply size difference penalty
        const sizePenalty = smallerSize / largerSize;
        const finalScore = Math.round(matchScore * sizePenalty);

        return Math.min(Math.max(finalScore, 0), 100);
    }

    static normalizeText(text) {
        return text.toLowerCase()
            .replace(/[^\w\s]/g, '') // Remove punctuation
            .replace(/\s+/g, ' ')    // Normalize whitespace
            .trim();
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
