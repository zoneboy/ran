import { User, Announcement, Payment, Message, MembershipStatus } from '../types';
import { MOCK_USERS, MOCK_ANNOUNCEMENTS, MOCK_PAYMENTS } from './mockData';
// @ts-ignore
import bcrypt from 'bcryptjs';

// CONFIGURATION
// FALSE = Live (Real Backend)
// TRUE = Mock (Local Storage)
const USE_MOCK_BACKEND = false; 

// Determine API URL based on environment
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_URL = isLocal 
    ? 'http://localhost:5000/api'  // Local Backend Server
    : '/.netlify/functions/api';   // Production Backend (Netlify Functions)

// Helper for delays
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Local Storage Keys
const USERS_KEY = 'ran_users';
const CURRENT_USER_KEY = 'ran_user';
const ANNOUNCEMENTS_KEY = 'ran_announcements';
const PAYMENTS_KEY = 'ran_payments';
const MESSAGES_KEY = 'ran_messages';

// ... (Rest of helper functions same as before) ...
// Helper: Check for expiration and update status
const checkAndExpireUser = (user: any): any => {
  if (user.role === 'ADMIN') return user;
  
  const today = new Date().toISOString().split('T')[0];
  if (user.expiryDate && user.expiryDate < today && user.status === MembershipStatus.ACTIVE) {
     return { ...user, status: MembershipStatus.EXPIRED };
  }
  return user;
};

// Helper: Get users from storage, or RESTORE defaults if missing
const getStoredUsers = () => {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(USERS_KEY);
  if (!stored || JSON.parse(stored).length === 0) {
    // console.log('Database empty or missing. Restoring Default Mock Data...');
    // Only restore if we are actually using mock backend to avoid confusion
    if (USE_MOCK_BACKEND) {
        const salt = bcrypt.genSaltSync(10);
        const hash = bcrypt.hashSync('password123', salt);
        const usersWithPassword = MOCK_USERS.map(u => ({...u, password: hash}));
        try { localStorage.setItem(USERS_KEY, JSON.stringify(usersWithPassword)); } catch (e) {}
        return usersWithPassword;
    }
    return [];
  }
  return JSON.parse(stored);
};

const getStoredAnnouncements = () => {
    if (typeof window === 'undefined') return [];
    const stored = localStorage.getItem(ANNOUNCEMENTS_KEY);
    return stored ? JSON.parse(stored) : (USE_MOCK_BACKEND ? MOCK_ANNOUNCEMENTS : []);
};

const getStoredPayments = () => {
    if (typeof window === 'undefined') return [];
    const stored = localStorage.getItem(PAYMENTS_KEY);
    return stored ? JSON.parse(stored) : (USE_MOCK_BACKEND ? MOCK_PAYMENTS : []);
};

const getStoredMessages = () => {
    if (typeof window === 'undefined') return [];
    const stored = localStorage.getItem(MESSAGES_KEY);
    return stored ? JSON.parse(stored) : [];
};

const handleResponse = async (res: Response) => {
    if (!res.ok) {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            const errorData = await res.json();
            throw new Error(errorData.message || 'Request failed');
        } else {
            // Handle non-JSON errors (like 404 HTML pages or 500 server errors)
            const text = await res.text();
            console.error("API Error (Non-JSON):", text);
            if (res.status === 404) {
                 throw new Error(`Endpoint not found (404). Ensure backend is running.`);
            }
            throw new Error(`Server Error: ${res.status} ${res.statusText}. Check backend logs.`);
        }
    }
    return res.json();
};

// Initialize helpers only if using mock
if (USE_MOCK_BACKEND) {
    getStoredUsers();
    getStoredAnnouncements();
    getStoredPayments();
}

export const api = {
  // Authentication
  login: async (email: string, password?: string): Promise<User> => {
    if (USE_MOCK_BACKEND) {
      await delay(800);
      const users: any[] = getStoredUsers();
      let user = users.find(u => u.email === email);
      if (!user) throw new Error('Invalid email or password');
      const updatedUser = checkAndExpireUser(user);
      if (updatedUser.status !== user.status) {
         user = updatedUser;
         const index = users.findIndex(u => u.id === user.id);
         users[index] = user;
         localStorage.setItem(USERS_KEY, JSON.stringify(users));
      }
      if (user.status === 'Pending') throw new Error('Account pending approval.');
      if (user.status === 'Suspended') throw new Error('Account suspended.');
      
      // Pass check logic...
      // Return safe user...
      const { password: _, ...safeUser } = user;
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(safeUser));
      return safeUser as User;
    } 
    
    // LIVE MODE
    const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    const user = await handleResponse(res);
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    return user;
  },

  register: async (userData: any): Promise<User> => {
    if (USE_MOCK_BACKEND) {
      await delay(1200);
      const users: any[] = getStoredUsers();
      if (users.some(u => u.email === userData.email)) throw new Error('Email exists');
      // ... mock register logic ...
      // Return
      return userData as User; 
    }
    
    // LIVE MODE
    const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
    });
    return await handleResponse(res);
  },

  resetPassword: async (email: string): Promise<void> => {
    if (USE_MOCK_BACKEND) { await delay(500); return; }
    const res = await fetch(`${API_URL}/auth/request-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
    });
    if (!res.ok) throw new Error('Request failed');
  },

  confirmPasswordReset: async (email: string, token: string, newPassword: string): Promise<void> => {
      const res = await fetch(`${API_URL}/auth/confirm-reset`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, token, newPassword })
      });
      await handleResponse(res);
  },

  logout: async () => {
    localStorage.removeItem(CURRENT_USER_KEY);
  },

  getCurrentUser: async (): Promise<User | null> => {
    const stored = localStorage.getItem(CURRENT_USER_KEY);
    return stored ? JSON.parse(stored) : null;
  },

  // User Management
  getUser: async (id: string): Promise<User | null> => {
    if (USE_MOCK_BACKEND) {
        const users = getStoredUsers();
        let found = users.find((u: any) => u.id === id);
        return found ? checkAndExpireUser(found) : null;
    }
    const res = await fetch(`${API_URL}/users/${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    return await res.json();
  },

  getUsers: async (): Promise<User[]> => {
    if (USE_MOCK_BACKEND) {
      await delay(500);
      const users: any[] = getStoredUsers();
      return users.map((u: any) => checkAndExpireUser(u));
    }
    const res = await fetch(`${API_URL}/users`);
    return await handleResponse(res);
  },

  updateUser: async (updatedUser: User): Promise<User> => {
    if (USE_MOCK_BACKEND) {
      // ... mock update logic ...
      return updatedUser;
    }
    const res = await fetch(`${API_URL}/users/${encodeURIComponent(updatedUser.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedUser)
    });
    const data = await handleResponse(res);
    const currentUser = JSON.parse(localStorage.getItem(CURRENT_USER_KEY) || '{}');
    if (currentUser.id === data.id) {
       localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(data));
    }
    return data;
  },

  updateUserId: async (currentId: string, newId: string): Promise<void> => {
     const res = await fetch(`${API_URL}/users/update-id`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentId, newId })
    });
    await handleResponse(res);
  },

  // Announcements
  getAnnouncements: async (): Promise<Announcement[]> => {
    if (USE_MOCK_BACKEND) return getStoredAnnouncements();
    const res = await fetch(`${API_URL}/announcements`);
    return await handleResponse(res);
  },

  createAnnouncement: async (announcement: Omit<Announcement, 'id'>): Promise<Announcement> => {
    if (USE_MOCK_BACKEND) return {} as Announcement; // Mock simplified
    const res = await fetch(`${API_URL}/announcements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(announcement)
    });
    return await handleResponse(res);
  },

  deleteAnnouncement: async (id: string): Promise<void> => {
    if (USE_MOCK_BACKEND) return;
    await fetch(`${API_URL}/announcements/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  // Payments
  getAllPayments: async (): Promise<Payment[]> => {
    if (USE_MOCK_BACKEND) return getStoredPayments();
    const res = await fetch(`${API_URL}/payments`);
    return await handleResponse(res);
  },

  getPayments: async (userId: string): Promise<Payment[]> => {
    if (USE_MOCK_BACKEND) return getStoredPayments().filter((p: Payment) => p.userId === userId);
    const res = await fetch(`${API_URL}/payments/${encodeURIComponent(userId)}`);
    return await handleResponse(res);
  },

  createPayment: async (paymentData: any): Promise<Payment> => {
    if (USE_MOCK_BACKEND) return {} as Payment;
    const res = await fetch(`${API_URL}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentData)
    });
    return await handleResponse(res);
  },

  updatePaymentStatus: async (paymentId: string, status: 'Successful' | 'Pending' | 'Failed'): Promise<void> => {
    if (USE_MOCK_BACKEND) return;
    await fetch(`${API_URL}/payments/${encodeURIComponent(paymentId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
    });
  },

  deletePayment: async (paymentId: string): Promise<void> => {
    if (USE_MOCK_BACKEND) return;
    await fetch(`${API_URL}/payments/${encodeURIComponent(paymentId)}`, { method: 'DELETE' });
  },

  // Messaging
  getConversations: async (userId: string): Promise<User[]> => {
    if (USE_MOCK_BACKEND) {
        // Mock logic for conversations
        const messages: Message[] = getStoredMessages();
        const users = getStoredUsers();
        const interactedUserIds = new Set<string>();
        messages.forEach(msg => {
            if (msg.senderId === userId) interactedUserIds.add(msg.receiverId);
            if (msg.receiverId === userId) interactedUserIds.add(msg.senderId);
        });
        return Array.from(interactedUserIds)
            .map(id => users.find((u: any) => u.id === id))
            .filter((u): u is User => !!u);
    }
    
    // LIVE MODE - Add Timestamp to prevent caching of empty lists
    const res = await fetch(`${API_URL}/messages/conversations/${encodeURIComponent(userId)}?t=${Date.now()}`);
    return await handleResponse(res);
  },

  getMessages: async (userId: string, otherUserId: string): Promise<Message[]> => {
    if (USE_MOCK_BACKEND) {
        const messages: Message[] = getStoredMessages();
        return messages
            .filter(msg => 
                (msg.senderId === userId && msg.receiverId === otherUserId) || 
                (msg.senderId === otherUserId && msg.receiverId === userId)
            )
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }
    const res = await fetch(`${API_URL}/messages/${encodeURIComponent(userId)}/${encodeURIComponent(otherUserId)}`);
    return await handleResponse(res);
  },

  sendMessage: async (senderId: string, receiverId: string, content: string): Promise<Message> => {
    if (USE_MOCK_BACKEND) {
        const messages: Message[] = getStoredMessages();
        const newMessage: Message = {
            id: `msg-${Date.now()}`,
            senderId,
            receiverId,
            content,
            timestamp: new Date().toISOString(),
            isRead: false
        };
        messages.push(newMessage);
        localStorage.setItem(MESSAGES_KEY, JSON.stringify(messages));
        return newMessage;
    }
    const res = await fetch(`${API_URL}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senderId, receiverId, content })
    });
    return await handleResponse(res);
  },

  markMessagesRead: async (userId: string, otherUserId: string): Promise<void> => {
    if (USE_MOCK_BACKEND) {
        const messages: Message[] = getStoredMessages();
        let changed = false;
        const updated = messages.map(msg => {
            if (msg.receiverId === userId && msg.senderId === otherUserId && !msg.isRead) {
                changed = true;
                return { ...msg, isRead: true };
            }
            return msg;
        });
        if (changed) localStorage.setItem(MESSAGES_KEY, JSON.stringify(updated));
        return;
    }
    await fetch(`${API_URL}/messages/read/${encodeURIComponent(userId)}/${encodeURIComponent(otherUserId)}`, { method: 'PUT' });
  },
  
  getUnreadCount: async (userId: string): Promise<number> => {
      if (USE_MOCK_BACKEND) {
          const messages: Message[] = getStoredMessages();
          return messages.filter(msg => msg.receiverId === userId && !msg.isRead).length;
      }
      try {
          const res = await fetch(`${API_URL}/messages/unread/${encodeURIComponent(userId)}`);
          if(!res.ok) return 0;
          const data = await res.json();
          return data.count;
      } catch {
          return 0;
      }
  }
};