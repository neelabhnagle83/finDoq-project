// Add this endpoint to handle credit deductions

/**
 * POST /api/user/credits/deduct
 * Deducts credits from the user's account
 */
router.post('/credits/deduct', authenticate, async (req, res) => {
    try {
        const { deduct = 1 } = req.body;
        const userId = req.user.id;
        
        // Get current user
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        
        // Check if user has enough credits
        if (user.credits < deduct) {
            return res.status(400).json({ 
                success: false, 
                message: 'Insufficient credits',
                credits: user.credits
            });
        }
        
        // Deduct credits
        user.credits -= deduct;
        await user.save();
        
        // Return updated credits
        return res.json({ 
            success: true, 
            message: 'Credits deducted successfully',
            credits: user.credits
        });
    } catch (error) {
        console.error('Error deducting credits:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});
