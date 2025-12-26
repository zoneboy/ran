import { User, Announcement, Payment } from '../types';

// API Configuration for Netlify Functions
// We use a relative path '/api' which Netlify redirects to the function
const API_URL = '/api'; 

export const api = {
  // Authentication
  login: async (email: string, password?: string): Promise<User> => {
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
    localStorage.setItem('ran_user', JSON.stringify(user));
    return user;
  },

  register: async (userData: any): Promise<User> => {
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
    
    if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Reset failed');
    }
  },

  logout: async () => {
    localStorage.removeItem('ran_user');
  },

  getCurrentUser: async (): Promise<User | null> => {
    const stored = localStorage.getItem('ran_user');
    return stored ? JSON.parse(stored) : null;
  },

  // User Management
  getUser: async (id: string): Promise<User | null> => {
    const res = await fetch(`${API_URL}/users/${id}`);
    if (!res.ok) return null;
    return await res.json();
  },

  getUsers: async (): Promise<User[]> => {
    const res = await fetch(`${API_URL}/users`);
    return await res.json();
  },

  updateUser: async (updatedUser: User): Promise<User> => {
    const res = await fetch(`${API_URL}/users/${updatedUser.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedUser)
    });
    const data = await res.json();
    // Update local session if it's the current user
    const currentUser = JSON.parse(localStorage.getItem('ran_user') || '{}');
    if (currentUser.id === updatedUser.id) {
        localStorage.setItem('ran_user', JSON.stringify(data));
    }
    return data;
  },

  updateUserId: async (currentId: string, newId: string): Promise<void> => {
    const res = await fetch(`${API_URL}/users/update-id`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentId, newId })
    });
    if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to update ID');
    }
  },

  // Announcements CRUD
  getAnnouncements: async (): Promise<Announcement[]> => {
    const res = await fetch(`${API_URL}/announcements`);
    return await res.json();
  },

  createAnnouncement: async (announcement: Omit<Announcement, 'id'>): Promise<Announcement> => {
    const res = await fetch(`${API_URL}/announcements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(announcement)
    });
    return await res.json();
  },

  deleteAnnouncement: async (id: string): Promise<void> => {
    await fetch(`${API_URL}/announcements/${id}`, { method: 'DELETE' });
  },

  // Payments
  getAllPayments: async (): Promise<Payment[]> => {
    const res = await fetch(`${API_URL}/payments`);
    return await res.json();
  },

  getPayments: async (userId: string): Promise<Payment[]> => {
    const res = await fetch(`${API_URL}/payments/${userId}`);
    return await res.json();
  },

  createPayment: async (paymentData: any): Promise<Payment> => {
    const res = await fetch(`${API_URL}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentData)
    });
    if (!res.ok) throw new Error('Failed to record payment');
    return await res.json();
  },

  updatePaymentStatus: async (paymentId: string, status: 'Successful' | 'Pending' | 'Failed'): Promise<void> => {
    await fetch(`${API_URL}/payments/${paymentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
    });
  },

  deletePayment: async (paymentId: string): Promise<void> => {
    await fetch(`${API_URL}/payments/${paymentId}`, { method: 'DELETE' });
  }
};