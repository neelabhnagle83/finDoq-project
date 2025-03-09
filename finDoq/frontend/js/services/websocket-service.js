export default class WebSocketService {
    constructor(handlers = {}) {
        this.ws = null;
        this.handlers = handlers;
        this.connect();
    }

    connect() {
        this.ws = new WebSocket(`ws://${window.location.hostname}:${window.location.port}`);
        this.ws.onopen = this.handleOpen.bind(this);
        this.ws.onmessage = this.handleMessage.bind(this);
        this.ws.onclose = () => setTimeout(() => this.connect(), 3000);
    }

    handleOpen() {
        this.ws.send(JSON.stringify({
            type: 'subscribe',
            userId: localStorage.getItem('userId')
        }));
    }

    handleMessage(event) {
        try {
            const data = JSON.parse(event.data);
            if (this.handlers[data.type]) {
                this.handlers[data.type](data);
            }
        } catch (error) {
            console.error('WebSocket message error:', error);
        }
    }

    send(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }

    isConnected() {
        return this.ws && this.ws.readyState === WebSocket.OPEN;
    }
}
