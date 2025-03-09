import NotificationManager from '../ui/notifications.js';
import ApiService from '../services/api.js';

export default class CreditManager {
    constructor() {
        this.credits = 0;
        this.creditsElement = document.querySelector('.credits-count');
    }

    async loadCredits() {
        try {
            const { credits } = await ApiService.getUserProfile();
            this.updateCredits(credits);
            return credits;
        } catch (error) {
            console.error('Error loading credits:', error);
            return 0;
        }
    }

    updateCredits(newCredits) {
        this.credits = newCredits;
        if (this.creditsElement) {
            this.creditsElement.textContent = newCredits;
        }
    }

    getCredits() {
        return this.credits;
    }

    async deductCredit() {
        try {
            await ApiService.deductCredit();
            await this.loadCredits();
            return true;
        } catch (error) {
            console.error('Error deducting credit:', error);
            return false;
        }
    }
}
