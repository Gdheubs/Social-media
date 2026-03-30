import { io } from 'socket.io-client';

class WebSocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
  }

  connect(token) {
    if (this.socket?.connected) {
      return;
    }

    const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
    
    this.socket = io(BACKEND_URL, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      // Authenticate with JWT token
      if (token) {
        this.socket.emit('authenticate', { token });
      }
    });

    this.socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
    });

    // Listen for new notifications
    this.socket.on('new_notification', (notification) => {
      // Notify all registered listeners
      this.listeners.forEach((callback) => {
        callback('new_notification', notification);
      });
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  on(eventName, callback) {
    const listenerId = Math.random().toString(36).substr(2, 9);
    this.listeners.set(listenerId, (event, data) => {
      if (event === eventName) {
        callback(data);
      }
    });
    return listenerId;
  }

  off(listenerId) {
    this.listeners.delete(listenerId);
  }

  emit(eventName, data) {
    if (this.socket?.connected) {
      this.socket.emit(eventName, data);
    }
  }

  isConnected() {
    return this.socket?.connected || false;
  }
}

export default new WebSocketService();
