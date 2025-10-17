# Frontend Integration Guide

Complete guide for integrating all 4 messaging patterns (WebSocket, Redis Pub/Sub, NATS RPC, RabbitMQ) into frontend applications.

## Table of Contents

1. [Quick Start](#quick-start)
2. [WebSocket Pattern](#websocket-pattern)
3. [Redis Pub/Sub Pattern](#redis-pubsub-pattern)
4. [NATS RPC Pattern](#nats-rpc-pattern)
5. [RabbitMQ Pattern](#rabbitmq-pattern)
6. [Complete Application Example](#complete-application-example)
7. [Error Handling](#error-handling)
8. [Security Best Practices](#security-best-practices)
9. [Connection Management](#connection-management)

---

## Quick Start

### Installation

Install the required client libraries:

```bash
# For WebSocket
npm install socket.io-client

# For HTTP requests (Redis Pub/Sub, NATS RPC, RabbitMQ)
npm install axios
```

### Base Configuration

```typescript
// config.ts
export const API_CONFIG = {
  baseURL: 'http://localhost:3000',
  wsURL: 'http://localhost:3000',
  timeout: 30000,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
};
```

---

## WebSocket Pattern

Real-time bidirectional communication for chat applications, live updates, and collaborative features.

### TypeScript Types

```typescript
// types/websocket.types.ts
export interface User {
  id: string;
  username: string;
  rooms: string[];
}

export interface Message {
  userId: string;
  username: string;
  message: string;
  timestamp: string;
  room?: string;
}

export interface PrivateMessage {
  from: string;
  fromUsername: string;
  message: string;
  timestamp: string;
}

export interface RoomEvent {
  userId: string;
  username: string;
  room: string;
  timestamp: string;
}

export interface ConnectionEvent {
  userId: string;
  username: string;
  totalUsers: number;
  timestamp: string;
}

export interface WelcomeMessage {
  message: string;
  userId: string;
  connectedUsers: number;
}
```

### Vanilla JavaScript

```javascript
// websocket-client.js
import { io } from 'socket.io-client';

class WebSocketClient {
  constructor(url = 'http://localhost:3000', username = 'Anonymous') {
    this.socket = io(url, {
      auth: { username },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.setupListeners();
  }

  setupListeners() {
    // Connection events
    this.socket.on('connect', () => {
      console.log('Connected to WebSocket server');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
    });

    // Welcome message
    this.socket.on('welcome', (data) => {
      console.log('Welcome:', data);
    });

    // User events
    this.socket.on('userConnected', (data) => {
      console.log('User connected:', data);
    });

    this.socket.on('userDisconnected', (data) => {
      console.log('User disconnected:', data);
    });

    // Message events
    this.socket.on('message', (data) => {
      console.log('Message received:', data);
    });

    this.socket.on('privateMessage', (data) => {
      console.log('Private message:', data);
    });

    // Room events
    this.socket.on('userJoinedRoom', (data) => {
      console.log('User joined room:', data);
    });

    this.socket.on('userLeftRoom', (data) => {
      console.log('User left room:', data);
    });

    this.socket.on('roomMessage', (data) => {
      console.log('Room message:', data);
    });
  }

  // Send broadcast message
  sendMessage(message) {
    return new Promise((resolve, reject) => {
      this.socket.emit('message', { message }, (response) => {
        if (response.error) {
          reject(response.error);
        } else {
          resolve(response);
        }
      });
    });
  }

  // Send private message
  sendPrivateMessage(targetId, message) {
    return new Promise((resolve, reject) => {
      this.socket.emit('privateMessage', { targetId, message }, (response) => {
        if (response.error) {
          reject(response.error);
        } else {
          resolve(response);
        }
      });
    });
  }

  // Join room
  joinRoom(room) {
    return new Promise((resolve, reject) => {
      this.socket.emit('joinRoom', { room }, (response) => {
        if (response.error) {
          reject(response.error);
        } else {
          resolve(response);
        }
      });
    });
  }

  // Leave room
  leaveRoom(room) {
    return new Promise((resolve, reject) => {
      this.socket.emit('leaveRoom', { room }, (response) => {
        if (response.error) {
          reject(response.error);
        } else {
          resolve(response);
        }
      });
    });
  }

  // Send room message
  sendRoomMessage(room, message) {
    return new Promise((resolve, reject) => {
      this.socket.emit('roomMessage', { room, message }, (response) => {
        if (response.error) {
          reject(response.error);
        } else {
          resolve(response);
        }
      });
    });
  }

  // Get online users
  getOnlineUsers() {
    return new Promise((resolve, reject) => {
      this.socket.emit('getOnlineUsers', (response) => {
        if (response.error) {
          reject(response.error);
        } else {
          resolve(response);
        }
      });
    });
  }

  // Disconnect
  disconnect() {
    this.socket.disconnect();
  }

  // Reconnect
  reconnect() {
    this.socket.connect();
  }
}

// Usage
const client = new WebSocketClient('http://localhost:3000', 'JohnDoe');

client.sendMessage('Hello everyone!');
client.joinRoom('general').then(() => {
  client.sendRoomMessage('general', 'Hello room!');
});
```

### React Integration with Hooks

```typescript
// hooks/useWebSocket.ts
import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { Message, User, PrivateMessage, RoomEvent } from '../types/websocket.types';

interface UseWebSocketOptions {
  url: string;
  username: string;
  autoConnect?: boolean;
}

interface UseWebSocketReturn {
  socket: Socket | null;
  connected: boolean;
  messages: Message[];
  privateMessages: PrivateMessage[];
  users: User[];
  sendMessage: (message: string) => Promise<void>;
  sendPrivateMessage: (targetId: string, message: string) => Promise<void>;
  joinRoom: (room: string) => Promise<void>;
  leaveRoom: (room: string) => Promise<void>;
  sendRoomMessage: (room: string, message: string) => Promise<void>;
  getOnlineUsers: () => Promise<User[]>;
  disconnect: () => void;
  reconnect: () => void;
}

export function useWebSocket({
  url,
  username,
  autoConnect = true,
}: UseWebSocketOptions): UseWebSocketReturn {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [privateMessages, setPrivateMessages] = useState<PrivateMessage[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    if (!autoConnect) return;

    // Initialize socket
    socketRef.current = io(url, {
      auth: { username },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    const socket = socketRef.current;

    // Connection events
    socket.on('connect', () => {
      console.log('Connected to WebSocket server');
      setConnected(true);
    });

    socket.on('disconnect', (reason) => {
      console.log('Disconnected:', reason);
      setConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
    });

    // Welcome message
    socket.on('welcome', (data) => {
      console.log('Welcome:', data);
    });

    // User events
    socket.on('userConnected', (data) => {
      console.log('User connected:', data);
    });

    socket.on('userDisconnected', (data) => {
      console.log('User disconnected:', data);
    });

    // Message events
    socket.on('message', (data: Message) => {
      setMessages((prev) => [...prev, data]);
    });

    socket.on('privateMessage', (data: PrivateMessage) => {
      setPrivateMessages((prev) => [...prev, data]);
    });

    socket.on('roomMessage', (data: Message) => {
      setMessages((prev) => [...prev, data]);
    });

    // Room events
    socket.on('userJoinedRoom', (data: RoomEvent) => {
      console.log('User joined room:', data);
    });

    socket.on('userLeftRoom', (data: RoomEvent) => {
      console.log('User left room:', data);
    });

    // Cleanup
    return () => {
      socket.disconnect();
    };
  }, [url, username, autoConnect]);

  const sendMessage = useCallback(async (message: string) => {
    if (!socketRef.current) throw new Error('Socket not connected');

    return new Promise<void>((resolve, reject) => {
      socketRef.current!.emit('message', { message }, (response: any) => {
        if (response.error) reject(response.error);
        else resolve();
      });
    });
  }, []);

  const sendPrivateMessage = useCallback(async (targetId: string, message: string) => {
    if (!socketRef.current) throw new Error('Socket not connected');

    return new Promise<void>((resolve, reject) => {
      socketRef.current!.emit('privateMessage', { targetId, message }, (response: any) => {
        if (response.error) reject(response.error);
        else resolve();
      });
    });
  }, []);

  const joinRoom = useCallback(async (room: string) => {
    if (!socketRef.current) throw new Error('Socket not connected');

    return new Promise<void>((resolve, reject) => {
      socketRef.current!.emit('joinRoom', { room }, (response: any) => {
        if (response.error) reject(response.error);
        else resolve();
      });
    });
  }, []);

  const leaveRoom = useCallback(async (room: string) => {
    if (!socketRef.current) throw new Error('Socket not connected');

    return new Promise<void>((resolve, reject) => {
      socketRef.current!.emit('leaveRoom', { room }, (response: any) => {
        if (response.error) reject(response.error);
        else resolve();
      });
    });
  }, []);

  const sendRoomMessage = useCallback(async (room: string, message: string) => {
    if (!socketRef.current) throw new Error('Socket not connected');

    return new Promise<void>((resolve, reject) => {
      socketRef.current!.emit('roomMessage', { room, message }, (response: any) => {
        if (response.error) reject(response.error);
        else resolve();
      });
    });
  }, []);

  const getOnlineUsers = useCallback(async () => {
    if (!socketRef.current) throw new Error('Socket not connected');

    return new Promise<User[]>((resolve, reject) => {
      socketRef.current!.emit('getOnlineUsers', (response: any) => {
        if (response.error) reject(response.error);
        else {
          setUsers(response.users);
          resolve(response.users);
        }
      });
    });
  }, []);

  const disconnect = useCallback(() => {
    socketRef.current?.disconnect();
  }, []);

  const reconnect = useCallback(() => {
    socketRef.current?.connect();
  }, []);

  return {
    socket: socketRef.current,
    connected,
    messages,
    privateMessages,
    users,
    sendMessage,
    sendPrivateMessage,
    joinRoom,
    leaveRoom,
    sendRoomMessage,
    getOnlineUsers,
    disconnect,
    reconnect,
  };
}
```

```typescript
// components/ChatComponent.tsx
import React, { useState, useEffect } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';

export function ChatComponent() {
  const [messageInput, setMessageInput] = useState('');
  const [roomInput, setRoomInput] = useState('');
  const [currentRoom, setCurrentRoom] = useState<string | null>(null);

  const {
    connected,
    messages,
    users,
    sendMessage,
    joinRoom,
    leaveRoom,
    sendRoomMessage,
    getOnlineUsers,
  } = useWebSocket({
    url: 'http://localhost:3000',
    username: 'ReactUser',
  });

  useEffect(() => {
    if (connected) {
      getOnlineUsers();
    }
  }, [connected, getOnlineUsers]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim()) return;

    try {
      if (currentRoom) {
        await sendRoomMessage(currentRoom, messageInput);
      } else {
        await sendMessage(messageInput);
      }
      setMessageInput('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomInput.trim()) return;

    try {
      await joinRoom(roomInput);
      setCurrentRoom(roomInput);
      setRoomInput('');
    } catch (error) {
      console.error('Error joining room:', error);
    }
  };

  const handleLeaveRoom = async () => {
    if (!currentRoom) return;

    try {
      await leaveRoom(currentRoom);
      setCurrentRoom(null);
    } catch (error) {
      console.error('Error leaving room:', error);
    }
  };

  return (
    <div className="chat-container">
      <div className="status">
        Status: {connected ? 'Connected' : 'Disconnected'}
        {currentRoom && ` | Room: ${currentRoom}`}
      </div>

      <div className="users">
        <h3>Online Users ({users.length})</h3>
        <ul>
          {users.map((user) => (
            <li key={user.id}>{user.username}</li>
          ))}
        </ul>
      </div>

      <div className="messages">
        <h3>Messages</h3>
        <div className="message-list">
          {messages.map((msg, index) => (
            <div key={index} className="message">
              <strong>{msg.username}:</strong> {msg.message}
              <span className="timestamp">{new Date(msg.timestamp).toLocaleTimeString()}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="room-controls">
        <form onSubmit={handleJoinRoom}>
          <input
            type="text"
            value={roomInput}
            onChange={(e) => setRoomInput(e.target.value)}
            placeholder="Room name"
          />
          <button type="submit">Join Room</button>
        </form>
        {currentRoom && (
          <button onClick={handleLeaveRoom}>Leave Room</button>
        )}
      </div>

      <form onSubmit={handleSendMessage} className="message-form">
        <input
          type="text"
          value={messageInput}
          onChange={(e) => setMessageInput(e.target.value)}
          placeholder="Type a message..."
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}
```

### Vue 3 Composition API

```typescript
// composables/useWebSocket.ts
import { ref, onMounted, onUnmounted } from 'vue';
import { io, Socket } from 'socket.io-client';
import type { Message, User, PrivateMessage } from '../types/websocket.types';

export function useWebSocket(url: string, username: string) {
  const socket = ref<Socket | null>(null);
  const connected = ref(false);
  const messages = ref<Message[]>([]);
  const privateMessages = ref<PrivateMessage[]>([]);
  const users = ref<User[]>([]);

  const connect = () => {
    socket.value = io(url, {
      auth: { username },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    // Connection events
    socket.value.on('connect', () => {
      console.log('Connected to WebSocket server');
      connected.value = true;
    });

    socket.value.on('disconnect', (reason) => {
      console.log('Disconnected:', reason);
      connected.value = false;
    });

    socket.value.on('connect_error', (error) => {
      console.error('Connection error:', error);
    });

    // Message events
    socket.value.on('message', (data: Message) => {
      messages.value.push(data);
    });

    socket.value.on('privateMessage', (data: PrivateMessage) => {
      privateMessages.value.push(data);
    });

    socket.value.on('roomMessage', (data: Message) => {
      messages.value.push(data);
    });
  };

  const sendMessage = (message: string): Promise<void> => {
    if (!socket.value) throw new Error('Socket not connected');

    return new Promise((resolve, reject) => {
      socket.value!.emit('message', { message }, (response: any) => {
        if (response.error) reject(response.error);
        else resolve();
      });
    });
  };

  const sendPrivateMessage = (targetId: string, message: string): Promise<void> => {
    if (!socket.value) throw new Error('Socket not connected');

    return new Promise((resolve, reject) => {
      socket.value!.emit('privateMessage', { targetId, message }, (response: any) => {
        if (response.error) reject(response.error);
        else resolve();
      });
    });
  };

  const joinRoom = (room: string): Promise<void> => {
    if (!socket.value) throw new Error('Socket not connected');

    return new Promise((resolve, reject) => {
      socket.value!.emit('joinRoom', { room }, (response: any) => {
        if (response.error) reject(response.error);
        else resolve();
      });
    });
  };

  const leaveRoom = (room: string): Promise<void> => {
    if (!socket.value) throw new Error('Socket not connected');

    return new Promise((resolve, reject) => {
      socket.value!.emit('leaveRoom', { room }, (response: any) => {
        if (response.error) reject(response.error);
        else resolve();
      });
    });
  };

  const sendRoomMessage = (room: string, message: string): Promise<void> => {
    if (!socket.value) throw new Error('Socket not connected');

    return new Promise((resolve, reject) => {
      socket.value!.emit('roomMessage', { room, message }, (response: any) => {
        if (response.error) reject(response.error);
        else resolve();
      });
    });
  };

  const getOnlineUsers = (): Promise<User[]> => {
    if (!socket.value) throw new Error('Socket not connected');

    return new Promise((resolve, reject) => {
      socket.value!.emit('getOnlineUsers', (response: any) => {
        if (response.error) reject(response.error);
        else {
          users.value = response.users;
          resolve(response.users);
        }
      });
    });
  };

  const disconnect = () => {
    socket.value?.disconnect();
  };

  onMounted(() => {
    connect();
  });

  onUnmounted(() => {
    disconnect();
  });

  return {
    socket,
    connected,
    messages,
    privateMessages,
    users,
    sendMessage,
    sendPrivateMessage,
    joinRoom,
    leaveRoom,
    sendRoomMessage,
    getOnlineUsers,
    disconnect,
  };
}
```

```vue
<!-- components/ChatComponent.vue -->
<template>
  <div class="chat-container">
    <div class="status">
      Status: {{ connected ? 'Connected' : 'Disconnected' }}
      <span v-if="currentRoom"> | Room: {{ currentRoom }}</span>
    </div>

    <div class="users">
      <h3>Online Users ({{ users.length }})</h3>
      <ul>
        <li v-for="user in users" :key="user.id">{{ user.username }}</li>
      </ul>
    </div>

    <div class="messages">
      <h3>Messages</h3>
      <div class="message-list">
        <div v-for="(msg, index) in messages" :key="index" class="message">
          <strong>{{ msg.username }}:</strong> {{ msg.message }}
          <span class="timestamp">{{ formatTime(msg.timestamp) }}</span>
        </div>
      </div>
    </div>

    <div class="room-controls">
      <form @submit.prevent="handleJoinRoom">
        <input v-model="roomInput" placeholder="Room name" />
        <button type="submit">Join Room</button>
      </form>
      <button v-if="currentRoom" @click="handleLeaveRoom">Leave Room</button>
    </div>

    <form @submit.prevent="handleSendMessage" class="message-form">
      <input v-model="messageInput" placeholder="Type a message..." />
      <button type="submit">Send</button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useWebSocket } from '../composables/useWebSocket';

const messageInput = ref('');
const roomInput = ref('');
const currentRoom = ref<string | null>(null);

const {
  connected,
  messages,
  users,
  sendMessage,
  joinRoom,
  leaveRoom,
  sendRoomMessage,
  getOnlineUsers,
} = useWebSocket('http://localhost:3000', 'VueUser');

watch(connected, (isConnected) => {
  if (isConnected) {
    getOnlineUsers();
  }
});

const handleSendMessage = async () => {
  if (!messageInput.value.trim()) return;

  try {
    if (currentRoom.value) {
      await sendRoomMessage(currentRoom.value, messageInput.value);
    } else {
      await sendMessage(messageInput.value);
    }
    messageInput.value = '';
  } catch (error) {
    console.error('Error sending message:', error);
  }
};

const handleJoinRoom = async () => {
  if (!roomInput.value.trim()) return;

  try {
    await joinRoom(roomInput.value);
    currentRoom.value = roomInput.value;
    roomInput.value = '';
  } catch (error) {
    console.error('Error joining room:', error);
  }
};

const handleLeaveRoom = async () => {
  if (!currentRoom.value) return;

  try {
    await leaveRoom(currentRoom.value);
    currentRoom.value = null;
  } catch (error) {
    console.error('Error leaving room:', error);
  }
};

const formatTime = (timestamp: string) => {
  return new Date(timestamp).toLocaleTimeString();
};
</script>
```

### Angular Service

```typescript
// services/websocket.service.ts
import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { BehaviorSubject, Observable } from 'rxjs';
import { Message, User, PrivateMessage } from '../types/websocket.types';

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {
  private socket: Socket | null = null;
  private connectedSubject = new BehaviorSubject<boolean>(false);
  private messagesSubject = new BehaviorSubject<Message[]>([]);
  private privateMessagesSubject = new BehaviorSubject<PrivateMessage[]>([]);
  private usersSubject = new BehaviorSubject<User[]>([]);

  public connected$ = this.connectedSubject.asObservable();
  public messages$ = this.messagesSubject.asObservable();
  public privateMessages$ = this.privateMessagesSubject.asObservable();
  public users$ = this.usersSubject.asObservable();

  connect(url: string, username: string): void {
    if (this.socket) {
      this.disconnect();
    }

    this.socket = io(url, {
      auth: { username },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.setupListeners();
  }

  private setupListeners(): void {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      console.log('Connected to WebSocket server');
      this.connectedSubject.next(true);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Disconnected:', reason);
      this.connectedSubject.next(false);
    });

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
    });

    // Message events
    this.socket.on('message', (data: Message) => {
      const messages = this.messagesSubject.value;
      this.messagesSubject.next([...messages, data]);
    });

    this.socket.on('privateMessage', (data: PrivateMessage) => {
      const privateMessages = this.privateMessagesSubject.value;
      this.privateMessagesSubject.next([...privateMessages, data]);
    });

    this.socket.on('roomMessage', (data: Message) => {
      const messages = this.messagesSubject.value;
      this.messagesSubject.next([...messages, data]);
    });
  }

  sendMessage(message: string): Promise<void> {
    if (!this.socket) throw new Error('Socket not connected');

    return new Promise((resolve, reject) => {
      this.socket!.emit('message', { message }, (response: any) => {
        if (response.error) reject(response.error);
        else resolve();
      });
    });
  }

  sendPrivateMessage(targetId: string, message: string): Promise<void> {
    if (!this.socket) throw new Error('Socket not connected');

    return new Promise((resolve, reject) => {
      this.socket!.emit('privateMessage', { targetId, message }, (response: any) => {
        if (response.error) reject(response.error);
        else resolve();
      });
    });
  }

  joinRoom(room: string): Promise<void> {
    if (!this.socket) throw new Error('Socket not connected');

    return new Promise((resolve, reject) => {
      this.socket!.emit('joinRoom', { room }, (response: any) => {
        if (response.error) reject(response.error);
        else resolve();
      });
    });
  }

  leaveRoom(room: string): Promise<void> {
    if (!this.socket) throw new Error('Socket not connected');

    return new Promise((resolve, reject) => {
      this.socket!.emit('leaveRoom', { room }, (response: any) => {
        if (response.error) reject(response.error);
        else resolve();
      });
    });
  }

  sendRoomMessage(room: string, message: string): Promise<void> {
    if (!this.socket) throw new Error('Socket not connected');

    return new Promise((resolve, reject) => {
      this.socket!.emit('roomMessage', { room, message }, (response: any) => {
        if (response.error) reject(response.error);
        else resolve();
      });
    });
  }

  getOnlineUsers(): Promise<User[]> {
    if (!this.socket) throw new Error('Socket not connected');

    return new Promise((resolve, reject) => {
      this.socket!.emit('getOnlineUsers', (response: any) => {
        if (response.error) reject(response.error);
        else {
          this.usersSubject.next(response.users);
          resolve(response.users);
        }
      });
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}
```

```typescript
// components/chat.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { WebSocketService } from '../services/websocket.service';
import { Message, User } from '../types/websocket.types';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.css']
})
export class ChatComponent implements OnInit, OnDestroy {
  connected = false;
  messages: Message[] = [];
  users: User[] = [];
  messageInput = '';
  roomInput = '';
  currentRoom: string | null = null;

  constructor(private wsService: WebSocketService) {}

  ngOnInit(): void {
    this.wsService.connect('http://localhost:3000', 'AngularUser');

    this.wsService.connected$.subscribe(connected => {
      this.connected = connected;
      if (connected) {
        this.wsService.getOnlineUsers();
      }
    });

    this.wsService.messages$.subscribe(messages => {
      this.messages = messages;
    });

    this.wsService.users$.subscribe(users => {
      this.users = users;
    });
  }

  ngOnDestroy(): void {
    this.wsService.disconnect();
  }

  async handleSendMessage(): Promise<void> {
    if (!this.messageInput.trim()) return;

    try {
      if (this.currentRoom) {
        await this.wsService.sendRoomMessage(this.currentRoom, this.messageInput);
      } else {
        await this.wsService.sendMessage(this.messageInput);
      }
      this.messageInput = '';
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }

  async handleJoinRoom(): Promise<void> {
    if (!this.roomInput.trim()) return;

    try {
      await this.wsService.joinRoom(this.roomInput);
      this.currentRoom = this.roomInput;
      this.roomInput = '';
    } catch (error) {
      console.error('Error joining room:', error);
    }
  }

  async handleLeaveRoom(): Promise<void> {
    if (!this.currentRoom) return;

    try {
      await this.wsService.leaveRoom(this.currentRoom);
      this.currentRoom = null;
    } catch (error) {
      console.error('Error leaving room:', error);
    }
  }
}
```

---

## Redis Pub/Sub Pattern

Horizontal scaling with publisher/subscriber architecture using Server-Sent Events (SSE).

### TypeScript Types

```typescript
// types/redis.types.ts
export interface PublishRequest {
  channel: string;
  message: string;
}

export interface PublishResponse {
  success: boolean;
  channel: string;
  message: string;
  subscriberCount: number;
  timestamp: string;
}

export interface SubscribeRequest {
  channel: string;
}

export interface SubscribeResponse {
  success: boolean;
  channel: string;
  message: string;
  subscriberCount: number;
}

export interface SSEMessage {
  channel: string;
  message: string;
  timestamp: string;
}
```

### Vanilla JavaScript

```javascript
// redis-client.js
import axios from 'axios';

class RedisClient {
  constructor(baseURL = 'http://localhost:3000') {
    this.baseURL = baseURL;
    this.api = axios.create({ baseURL });
    this.eventSources = new Map();
  }

  // Publish message to channel
  async publish(channel, message) {
    try {
      const response = await this.api.post('/redis-pubsub/publish', {
        channel,
        message,
      });
      return response.data;
    } catch (error) {
      console.error('Error publishing message:', error);
      throw error;
    }
  }

  // Subscribe to channel
  async subscribe(channel) {
    try {
      const response = await this.api.post('/redis-pubsub/subscribe', {
        channel,
      });
      return response.data;
    } catch (error) {
      console.error('Error subscribing:', error);
      throw error;
    }
  }

  // Unsubscribe from channel
  async unsubscribe(channel) {
    try {
      const response = await this.api.post(`/redis-pubsub/unsubscribe/${channel}`);

      // Close SSE connection if exists
      const eventSource = this.eventSources.get(channel);
      if (eventSource) {
        eventSource.close();
        this.eventSources.delete(channel);
      }

      return response.data;
    } catch (error) {
      console.error('Error unsubscribing:', error);
      throw error;
    }
  }

  // Stream messages from channel using SSE
  streamChannel(channel, onMessage, onError) {
    // Close existing connection if any
    const existing = this.eventSources.get(channel);
    if (existing) {
      existing.close();
    }

    const eventSource = new EventSource(
      `${this.baseURL}/redis-pubsub/stream?channel=${channel}`
    );

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch (error) {
        console.error('Error parsing SSE message:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE error:', error);
      if (onError) onError(error);
    };

    this.eventSources.set(channel, eventSource);

    return () => {
      eventSource.close();
      this.eventSources.delete(channel);
    };
  }

  // Get status
  async getStatus() {
    try {
      const response = await this.api.get('/redis-pubsub/status');
      return response.data;
    } catch (error) {
      console.error('Error getting status:', error);
      throw error;
    }
  }

  // Close all SSE connections
  closeAll() {
    this.eventSources.forEach((eventSource) => {
      eventSource.close();
    });
    this.eventSources.clear();
  }
}

// Usage
const client = new RedisClient('http://localhost:3000');

// Subscribe and stream messages
await client.subscribe('news');
const unsubscribe = client.streamChannel(
  'news',
  (data) => console.log('Received:', data),
  (error) => console.error('Error:', error)
);

// Publish message
await client.publish('news', 'Breaking news!');

// Cleanup
unsubscribe();
```

### React Integration

```typescript
// hooks/useRedisPubSub.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import axios, { AxiosInstance } from 'axios';
import type { PublishResponse, SubscribeResponse, SSEMessage } from '../types/redis.types';

interface UseRedisPubSubOptions {
  baseURL: string;
}

interface UseRedisPubSubReturn {
  publish: (channel: string, message: string) => Promise<PublishResponse>;
  subscribe: (channel: string) => Promise<SubscribeResponse>;
  unsubscribe: (channel: string) => Promise<void>;
  streamChannel: (
    channel: string,
    onMessage: (data: SSEMessage) => void
  ) => () => void;
  messages: SSEMessage[];
  isConnected: boolean;
  getStatus: () => Promise<any>;
}

export function useRedisPubSub({ baseURL }: UseRedisPubSubOptions): UseRedisPubSubReturn {
  const [messages, setMessages] = useState<SSEMessage[]>([]);
  const [isConnected, setIsConnected] = useState(true);
  const apiRef = useRef<AxiosInstance>();
  const eventSourcesRef = useRef<Map<string, EventSource>>(new Map());

  useEffect(() => {
    apiRef.current = axios.create({ baseURL });

    return () => {
      // Cleanup all event sources
      eventSourcesRef.current.forEach((eventSource) => {
        eventSource.close();
      });
      eventSourcesRef.current.clear();
    };
  }, [baseURL]);

  const publish = useCallback(async (channel: string, message: string) => {
    if (!apiRef.current) throw new Error('API not initialized');

    try {
      const response = await apiRef.current.post<PublishResponse>(
        '/redis-pubsub/publish',
        { channel, message }
      );
      return response.data;
    } catch (error) {
      console.error('Error publishing message:', error);
      throw error;
    }
  }, []);

  const subscribe = useCallback(async (channel: string) => {
    if (!apiRef.current) throw new Error('API not initialized');

    try {
      const response = await apiRef.current.post<SubscribeResponse>(
        '/redis-pubsub/subscribe',
        { channel }
      );
      return response.data;
    } catch (error) {
      console.error('Error subscribing:', error);
      throw error;
    }
  }, []);

  const unsubscribe = useCallback(async (channel: string) => {
    if (!apiRef.current) throw new Error('API not initialized');

    try {
      await apiRef.current.post(`/redis-pubsub/unsubscribe/${channel}`);

      // Close SSE connection
      const eventSource = eventSourcesRef.current.get(channel);
      if (eventSource) {
        eventSource.close();
        eventSourcesRef.current.delete(channel);
      }
    } catch (error) {
      console.error('Error unsubscribing:', error);
      throw error;
    }
  }, []);

  const streamChannel = useCallback(
    (channel: string, onMessage: (data: SSEMessage) => void) => {
      // Close existing connection
      const existing = eventSourcesRef.current.get(channel);
      if (existing) {
        existing.close();
      }

      const eventSource = new EventSource(
        `${baseURL}/redis-pubsub/stream?channel=${channel}`
      );

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setMessages((prev) => [...prev, data]);
          onMessage(data);
        } catch (error) {
          console.error('Error parsing SSE message:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('SSE error:', error);
        setIsConnected(false);

        // Reconnect after delay
        setTimeout(() => {
          setIsConnected(true);
        }, 5000);
      };

      eventSource.onopen = () => {
        setIsConnected(true);
      };

      eventSourcesRef.current.set(channel, eventSource);

      return () => {
        eventSource.close();
        eventSourcesRef.current.delete(channel);
      };
    },
    [baseURL]
  );

  const getStatus = useCallback(async () => {
    if (!apiRef.current) throw new Error('API not initialized');

    try {
      const response = await apiRef.current.get('/redis-pubsub/status');
      return response.data;
    } catch (error) {
      console.error('Error getting status:', error);
      throw error;
    }
  }, []);

  return {
    publish,
    subscribe,
    unsubscribe,
    streamChannel,
    messages,
    isConnected,
    getStatus,
  };
}
```

---

## NATS RPC Pattern

Request/Response communication for microservices.

### TypeScript Types

```typescript
// types/nats.types.ts
export interface RequestPayload {
  subject: string;
  data: string;
}

export interface PublishPayload {
  subject: string;
  data: string;
}

export interface RequestResponse {
  success: boolean;
  response: string;
}

export interface PublishResponse {
  success: boolean;
}
```

### Vanilla JavaScript

```javascript
// nats-client.js
import axios from 'axios';

class NatsClient {
  constructor(baseURL = 'http://localhost:3000') {
    this.baseURL = baseURL;
    this.api = axios.create({ baseURL });
  }

  // Send request and wait for response
  async request(subject, data) {
    try {
      const response = await this.api.post('/nats-rpc/request', {
        subject,
        data,
      });
      return response.data;
    } catch (error) {
      console.error('Error sending request:', error);
      throw error;
    }
  }

  // Publish message (fire and forget)
  async publish(subject, data) {
    try {
      const response = await this.api.post('/nats-rpc/publish', {
        subject,
        data,
      });
      return response.data;
    } catch (error) {
      console.error('Error publishing:', error);
      throw error;
    }
  }

  // Get status
  async getStatus() {
    try {
      const response = await this.api.get('/nats-rpc/status');
      return response.data;
    } catch (error) {
      console.error('Error getting status:', error);
      throw error;
    }
  }
}

// Usage
const client = new NatsClient('http://localhost:3000');

// Send RPC request
const response = await client.request('greet', 'World');
console.log(response);

// Publish event
await client.publish('events', 'User logged in');
```

---

## RabbitMQ Pattern

Background job processing with message queues.

### TypeScript Types

```typescript
// types/rabbitmq.types.ts
export interface SendJobRequest {
  queue: string;
  message: string;
}

export interface SendJobResponse {
  success: boolean;
  queue: string;
}
```

### Vanilla JavaScript

```javascript
// rabbitmq-client.js
import axios from 'axios';

class RabbitMQClient {
  constructor(baseURL = 'http://localhost:3000') {
    this.baseURL = baseURL;
    this.api = axios.create({ baseURL });
  }

  // Send job to queue
  async sendJob(queue, message) {
    try {
      const response = await this.api.post('/rabbitmq/send', {
        queue,
        message,
      });
      return response.data;
    } catch (error) {
      console.error('Error sending job:', error);
      throw error;
    }
  }

  // Get status
  async getStatus() {
    try {
      const response = await this.api.get('/rabbitmq/status');
      return response.data;
    } catch (error) {
      console.error('Error getting status:', error);
      throw error;
    }
  }
}

// Usage
const client = new RabbitMQClient('http://localhost:3000');

// Send job
await client.sendJob('tasks', 'Process order #12345');
```

---

## Complete Application Example

A comprehensive example combining all four messaging patterns.

```typescript
// App.tsx - Complete React Application
import React, { useState, useEffect } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { useRedisPubSub } from './hooks/useRedisPubSub';

const API_URL = 'http://localhost:3000';

export function App() {
  // WebSocket
  const {
    connected: wsConnected,
    messages: wsMessages,
    sendMessage,
    joinRoom,
    sendRoomMessage,
  } = useWebSocket({ url: API_URL, username: 'DemoUser' });

  // Redis Pub/Sub
  const {
    messages: redisMessages,
    isConnected: redisConnected,
    publish,
    subscribe,
    streamChannel,
  } = useRedisPubSub({ baseURL: API_URL });

  const [messageInput, setMessageInput] = useState('');
  const [currentTab, setCurrentTab] = useState<'ws' | 'redis' | 'nats' | 'rabbitmq'>('ws');

  useEffect(() => {
    // Subscribe to Redis channel and start streaming
    subscribe('demo-channel').then(() => {
      streamChannel('demo-channel', (data) => {
        console.log('Redis message:', data);
      });
    });

    // Join default WebSocket room
    joinRoom('general');
  }, [subscribe, streamChannel, joinRoom]);

  const handleWebSocketSend = async () => {
    try {
      await sendRoomMessage('general', messageInput);
      setMessageInput('');
    } catch (error) {
      console.error('WebSocket error:', error);
    }
  };

  const handleRedisSend = async () => {
    try {
      await publish('demo-channel', messageInput);
      setMessageInput('');
    } catch (error) {
      console.error('Redis error:', error);
    }
  };

  return (
    <div className="app">
      <header>
        <h1>Messaging Patterns Demo</h1>
        <div className="status">
          <span className={wsConnected ? 'connected' : 'disconnected'}>
            WebSocket: {wsConnected ? 'Connected' : 'Disconnected'}
          </span>
          <span className={redisConnected ? 'connected' : 'disconnected'}>
            Redis: {redisConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </header>

      <nav className="tabs">
        <button
          className={currentTab === 'ws' ? 'active' : ''}
          onClick={() => setCurrentTab('ws')}
        >
          WebSocket
        </button>
        <button
          className={currentTab === 'redis' ? 'active' : ''}
          onClick={() => setCurrentTab('redis')}
        >
          Redis Pub/Sub
        </button>
      </nav>

      <main>
        {currentTab === 'ws' && (
          <div className="panel">
            <h2>WebSocket Messages</h2>
            <div className="messages">
              {wsMessages.map((msg, idx) => (
                <div key={idx} className="message">
                  <strong>{msg.username}:</strong> {msg.message}
                  <span className="time">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentTab === 'redis' && (
          <div className="panel">
            <h2>Redis Pub/Sub Messages</h2>
            <div className="messages">
              {redisMessages.map((msg, idx) => (
                <div key={idx} className="message">
                  <strong>{msg.channel}:</strong> {msg.message}
                  <span className="time">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <footer>
        <div className="input-group">
          <input
            type="text"
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && (currentTab === 'ws' ? handleWebSocketSend() : handleRedisSend())}
            placeholder={`Send ${currentTab.toUpperCase()} message...`}
          />
          <button onClick={currentTab === 'ws' ? handleWebSocketSend : handleRedisSend}>Send</button>
        </div>
      </footer>
    </div>
  );
}
```

---

## Error Handling

### Comprehensive Error Handling Strategy

```typescript
// utils/errorHandler.ts
export class MessagingError extends Error {
  constructor(
    message: string,
    public pattern: string,
    public code?: string,
    public originalError?: any
  ) {
    super(message);
    this.name = 'MessagingError';
  }
}

export function handleWebSocketError(error: any): MessagingError {
  if (error.type === 'TransportError') {
    return new MessagingError(
      'Failed to connect to WebSocket server',
      'websocket',
      'CONNECTION_FAILED',
      error
    );
  }

  return new MessagingError(
    error.message || 'Unknown WebSocket error',
    'websocket',
    'UNKNOWN_ERROR',
    error
  );
}

export function handleHTTPError(error: any, pattern: string): MessagingError {
  if (error.response) {
    return new MessagingError(
      error.response.data.message || 'Server error',
      pattern,
      error.response.status.toString(),
      error
    );
  } else if (error.request) {
    return new MessagingError(
      'No response from server',
      pattern,
      'NO_RESPONSE',
      error
    );
  } else {
    return new MessagingError(
      error.message || 'Request failed',
      pattern,
      'REQUEST_FAILED',
      error
    );
  }
}
```

---

## Security Best Practices

### 1. Authentication

```typescript
// auth/websocket-auth.ts
export interface AuthConfig {
  token: string;
  username: string;
}

export function createAuthenticatedSocket(url: string, auth: AuthConfig) {
  return io(url, {
    auth: {
      token: auth.token,
      username: auth.username,
    },
    transports: ['websocket'],
  });
}
```

### 2. Input Validation

```typescript
// utils/validation.ts
export function sanitizeMessage(message: string): string {
  // Remove HTML tags
  return message.replace(/<[^>]*>/g, '');
}

export function validateChannel(channel: string): boolean {
  // Only allow alphanumeric and hyphens
  return /^[a-zA-Z0-9-]+$/.test(channel);
}
```

### 3. Rate Limiting

```typescript
// utils/rateLimit.ts
export class RateLimiter {
  private requests: number[] = [];

  constructor(
    private maxRequests: number,
    private windowMs: number
  ) {}

  canMakeRequest(): boolean {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < this.windowMs);

    if (this.requests.length < this.maxRequests) {
      this.requests.push(now);
      return true;
    }

    return false;
  }
}
```

---

## Connection Management

### Automatic Reconnection

```typescript
// utils/connectionManager.ts
export class ConnectionManager {
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(
    private onConnect: () => void,
    private onDisconnect: () => void,
    private onReconnectFailed: () => void
  ) {}

  handleDisconnect() {
    this.onDisconnect();
    this.attemptReconnect();
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.onReconnectFailed();
      return;
    }

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);

    setTimeout(() => {
      this.reconnectAttempts++;
      console.log(`Reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
      this.onConnect();
    }, delay);
  }
}
```

---

## Best Practices Summary

1. **Always handle disconnections gracefully** with automatic reconnection logic
2. **Validate all user input** before sending to prevent injection attacks
3. **Implement rate limiting** to prevent abuse and excessive load
4. **Use TypeScript** for type safety across all messaging patterns
5. **Clean up resources** (close connections, unsubscribe) when components unmount
6. **Implement proper error boundaries** to catch and handle errors
7. **Use environment variables** for configuration
8. **Test connection resilience** by simulating network failures
9. **Monitor connection state** and provide UI feedback
10. **Implement logging** for debugging and monitoring

---

## Resources

- [Socket.IO Client Documentation](https://socket.io/docs/v4/client-api/)
- [EventSource API (SSE)](https://developer.mozilla.org/en-US/docs/Web/API/EventSource)
- [Axios Documentation](https://axios-http.com/docs/intro)
- [React Hooks Documentation](https://react.dev/reference/react)
- [Vue 3 Composition API](https://vuejs.org/guide/extras/composition-api-faq.html)
- [Angular HttpClient](https://angular.io/guide/http)
