import { User, Announcement, Payment } from '../types';

// API Configuration
// For Netlify production, we point directly to the function path to avoid redirect issues.
// For local development, we point to the local express server port (5000) or let Vite proxy if configured.
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// If local, assume server runs on 5000. If prod, use the Netlify function path.
const API_URL = isLocal ? 'http://localhost:5000/api' : '/.netlify/functions/api';

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
                 throw new Error(`Endpoint not found (404). The backend function is not reachable at ${API_URL}.`);
            }
            throw new Error(`Server Error: ${res.status} ${res.statusText}. The backend might be starting up or unreachable.`);
        }
    }
    return res.json();
};

export const api = {
  // Authentication
  login: async (email: string, password?: string): Promise<User> => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const user = await handleResponse(res);
    localStorage.setItem('ran_user', JSON.stringify(user));
    return user;
  },

  register: async (userData: any): Promise<User> => {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    return await handleResponse(res);
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
    await handleResponse(res);
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
    try {
        const res = await fetch(`${API_URL}/users/${encodeURIComponent(id)}`);
        if (!res.ok) return null;
        return await res.json();
    } catch (e) {
        return null;
    }
  },

  getUsers: async (): Promise<User[]> => {
    const res = await fetch(`${API_URL}/users`);
    return await handleResponse(res);
  },

  updateUser: async (updatedUser: User): Promise<User> => {
    const res = await fetch(`${API_URL}/users/${encodeURIComponent(updatedUser.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedUser)
    });
    const data = await handleResponse(res);
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
    await handleResponse(res);
  },

  // Announcements CRUD
  getAnnouncements: async (): Promise<Announcement[]> => {
    const res = await fetch(`${API_URL}/announcements`);
    return await handleResponse(res);
  },

  createAnnouncement: async (announcement: Omit<Announcement, 'id'>): Promise<Announcement> => {
    const res = await fetch(`${API_URL}/announcements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(announcement)
    });
    return await handleResponse(res);
  },

  deleteAnnouncement: async (id: string): Promise<void> => {
    await fetch(`${API_URL}/announcements/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  // Payments
  getAllPayments: async (): Promise<Payment[]> => {
    const res = await fetch(`${API_URL}/payments`);
    return await handleResponse(res);
  },

  getPayments: async (userId: string): Promise<Payment[]> => {
    const res = await fetch(`${API_URL}/payments/${encodeURIComponent(userId)}`);
    return await handleResponse(res);
  },

  createPayment: async (paymentData: any): Promise<Payment> => {
    const res = await fetch(`${API_URL}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentData)
    });
    return await handleResponse(res);
  },

  updatePaymentStatus: async (paymentId: string, status: 'Successful' | 'Pending' | 'Failed'): Promise<void> => {
    await fetch(`${API_URL}/payments/${encodeURIComponent(paymentId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
    });
  },

  deletePayment: async (paymentId: string): Promise<void> => {
    await fetch(`${API_URL}/payments/${encodeURIComponent(paymentId)}`, { method: 'DELETE' });
  }
};