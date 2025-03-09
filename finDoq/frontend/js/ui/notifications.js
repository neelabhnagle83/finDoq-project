export default class NotificationManager {
    static show(message, type = 'info', duration = 3000) {
        const notification = document.createElement('div');
        notification.className = `notification-${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        }, duration);
    }

    static error(message) {
        this.show(message, 'error', 3000);
    }

    static success(message) {
        this.show(message, 'success', 3000);
    }

    static info(message) {
        this.show(message, 'info', 3000);
    }
}
