import { User, Announcement, Payment, MembershipStatus, Message, Conversation } from '../types';
import { MOCK_USERS, MOCK_ANNOUNCEMENTS, MOCK_PAYMENTS } from './mockData';
// @ts-ignore
import bcrypt from 'bcryptjs';

// CONFIGURATION
// For Live App, we disable the mock backend.
const USE_MOCK_BACKEND = false; 
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_URL = isLocal ? 'http://localhost:5000/api' : '/.netlify/functions/api';

// Helper for delays
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Local Storage Keys
const USERS_KEY = 'ran_users';
const CURRENT_USER_KEY = 'ran_user';
const ANNOUNCEMENTS_KEY = 'ran_announcements';
const PAYMENTS_KEY = 'ran_payments';

// ... (Legacy mock helpers kept but not used when USE_MOCK_BACKEND = false) ...
const getStoredUsers = () => { return []; };
const getStoredAnnouncements = () => { return []; };
const getStoredPayments = () => { return []; };

export const api = {
  // Authentication
  login: async (email: string, password?: string): Promise<User> => {
    if (USE_MOCK_BACKEND) {
       // Mock logic (omitted for brevity since live is requested)
       throw new Error("Mock backend disabled for live deployment");
    } else {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Login failed');
      }
      
      const user = await res.json();
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
      return user;
    }
  },

  register: async (userData: any): Promise<User> => {
    if (USE_MOCK_BACKEND) return {} as User;
    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.message || 'Registration failed');
    }
    return await res.json();
  },

  resetPassword: async (email: string): Promise<void> => {
     if (USE_MOCK_BACKEND) return;
     const res = await fetch(`${API_URL}/auth/request-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
    });
    if (!res.ok) throw new Error('Request failed');
  },

  confirmPasswordReset: async (email: string, token: string, newPassword: string): Promise<void> => {
     if (USE_MOCK_BACKEND) return;
     const res = await fetch(`${API_URL}/auth/confirm-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token, newPassword })
    });
    if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Reset failed');
    }
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
     if (USE_MOCK_BACKEND) return null;
     const res = await fetch(`${API_URL}/users/${id}`);
     if (!res.ok) return null;
     return await res.json();
  },

  getUsers: async (): Promise<User[]> => {
    if (USE_MOCK_BACKEND) return [];
    const res = await fetch(`${API_URL}/users`);
    return await res.json();
  },

  updateUser: async (updatedUser: User): Promise<User> => {
    if (USE_MOCK_BACKEND) return updatedUser;
    const res = await fetch(`${API_URL}/users/${updatedUser.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedUser)
    });
    const data = await res.json();
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(data));
    return data;
  },

  updateUserId: async (currentId: string, newId: string): Promise<void> => {
    if (USE_MOCK_BACKEND) return;
    const res = await fetch(`${API_URL}/users/update-id`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentId, newId })
    });
    if (!res.ok) {
         const errorData = await res.json();
         throw new Error(errorData.message || 'Update ID failed');
    }
  },

  // Announcements CRUD
  getAnnouncements: async (): Promise<Announcement[]> => {
    if (USE_MOCK_BACKEND) return [];
    const res = await fetch(`${API_URL}/announcements`);
    return await res.json();
  },

  createAnnouncement: async (announcement: Omit<Announcement, 'id'>): Promise<Announcement> => {
    if (USE_MOCK_BACKEND) return {} as Announcement;
    const res = await fetch(`${API_URL}/announcements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(announcement)
    });
    return await res.json();
  },

  deleteAnnouncement: async (id: string): Promise<void> => {
    if (USE_MOCK_BACKEND) return;
    await fetch(`${API_URL}/announcements/${id}`, { method: 'DELETE' });
  },

  // Payments
  getPayments: async (userId: string): Promise<Payment[]> => {
    if (USE_MOCK_BACKEND) return [];
    const res = await fetch(`${API_URL}/payments/${userId}`);
    return await res.json();
  },

  getAllPayments: async (): Promise<Payment[]> => {
    if (USE_MOCK_BACKEND) return [];
    const res = await fetch(`${API_URL}/payments`);
    return await res.json();
  },

  createPayment: async (paymentData: any): Promise<Payment> => {
    if (USE_MOCK_BACKEND) return {} as Payment;
    const res = await fetch(`${API_URL}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentData)
    });
    if (!res.ok) throw new Error('Payment creation failed');
    return await res.json();
  },

  updatePaymentStatus: async (paymentId: string, status: 'Successful' | 'Pending' | 'Failed'): Promise<void> => {
    if (USE_MOCK_BACKEND) return;
    await fetch(`${API_URL}/payments/${paymentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
    });
  },

  deletePayment: async (paymentId: string): Promise<void> => {
    if (USE_MOCK_BACKEND) return;
    await fetch(`${API_URL}/payments/${paymentId}`, { method: 'DELETE' });
  },

  // --- MESSAGING API ---
  
  sendMessage: async (senderId: string, receiverId: string, content: string): Promise<Message> => {
     const res = await fetch(`${API_URL}/messages`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ senderId, receiverId, content })
     });
     if (!res.ok) throw new Error('Failed to send message');
     return await res.json();
  },

  getConversations: async (userId: string): Promise<Conversation[]> => {
     const res = await fetch(`${API_URL}/messages/conversations/${userId}`);
     if (!res.ok) return [];
     return await res.json();
  },

  getChatHistory: async (userId: string, contactId: string): Promise<Message[]> => {
     const res = await fetch(`${API_URL}/messages/${userId}/${contactId}`);
     if (!res.ok) return [];
     return await res.json();
  },

  markAsRead: async (userId: string, contactId: string): Promise<void> => {
     // userId is reading the messages from contactId
     await fetch(`${API_URL}/messages/read/${userId}/${contactId}`, { method: 'PUT' });
  }
};