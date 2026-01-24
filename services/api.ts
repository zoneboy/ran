
import { User, Announcement, Payment, Message, BankDetails } from '../types';

// Determine API URL based on environment
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_URL = isLocal 
    ? 'http://localhost:5000/api'  // Local Backend Server
    : '/.netlify/functions/api';   // Production Backend (Netlify Functions)

// In-memory user store (Replaces LocalStorage for security)
// Note: This means session is lost on refresh.
let sessionUser: User | null = null;

// Helper to get Auth Headers
const getAuthHeaders = () => {
    return (sessionUser && sessionUser.token) ? { 'Authorization': `Bearer ${sessionUser.token}` } : {};
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
                 throw new Error(`Endpoint not found (404). Backend route may be missing.`);
            }
            if (res.status === 401) {
                 throw new Error(`Authentication failed. Please login again.`);
            }
            if (res.status === 413) {
                 throw new Error(`File too large. Please upload a smaller file.`);
            }
            throw new Error(`Server Error: ${res.status} ${res.statusText}`);
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
    sessionUser = user;
    return user;
  },

  register: async (userData: any): Promise<User> => {
    const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
    });
    const user = await handleResponse(res);
    sessionUser = user;
    return user;
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
    try {
        await fetch(`${API_URL}/auth/logout`, { 
            method: 'POST'
        });
    } catch (e) {
        console.error("Logout failed on server", e);
    }
    sessionUser = null;
  },

  getCurrentUser: async (): Promise<User | null> => {
    return sessionUser;
  },

  // User Management
  getUser: async (id: string): Promise<User | null> => {
    // Using query param ?id=... to handle IDs with slashes safely
    const res = await fetch(`${API_URL}/user?id=${encodeURIComponent(id)}`, {
        headers: getAuthHeaders()
    });
    if (!res.ok) return null;
    return await res.json();
  },

  getUsers: async (): Promise<User[]> => {
    const res = await fetch(`${API_URL}/users`, {
        headers: getAuthHeaders()
    });
    return await handleResponse(res);
  },

  updateUser: async (updatedUser: User): Promise<User> => {
    // Changed to /user/update?id=... to avoid path param issues with slashes
    const res = await fetch(`${API_URL}/user/update?id=${encodeURIComponent(updatedUser.id)}`, {
        method: 'PUT',
        headers: { 
            'Content-Type': 'application/json',
            ...getAuthHeaders() 
        },
        body: JSON.stringify(updatedUser)
    });
    const data = await handleResponse(res);
    
    // Update memory if updating current user
    if (sessionUser && sessionUser.id === data.id) {
       const token = sessionUser.token || data.token;
       const safeData = { ...data, token };
       sessionUser = safeData;
       return safeData;
    }
    return data;
  },

  updateUserId: async (currentId: string, newId: string): Promise<void> => {
     const res = await fetch(`${API_URL}/users/update-id`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            ...getAuthHeaders()
        },
        body: JSON.stringify({ currentId, newId })
    });
    await handleResponse(res);
  },

  // Announcements
  getAnnouncements: async (): Promise<Announcement[]> => {
    const res = await fetch(`${API_URL}/announcements`);
    return await handleResponse(res);
  },

  createAnnouncement: async (announcement: Omit<Announcement, 'id'>): Promise<Announcement> => {
    const res = await fetch(`${API_URL}/announcements`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            ...getAuthHeaders()
        },
        body: JSON.stringify(announcement)
    });
    return await handleResponse(res);
  },

  deleteAnnouncement: async (id: string): Promise<void> => {
    await fetch(`${API_URL}/announcements/${encodeURIComponent(id)}`, { 
        method: 'DELETE',
        headers: getAuthHeaders()
    });
  },

  // Payments
  getAllPayments: async (): Promise<Payment[]> => {
    const res = await fetch(`${API_URL}/payments`, {
        headers: getAuthHeaders()
    });
    return await handleResponse(res);
  },

  getPayments: async (userId: string): Promise<Payment[]> => {
    // Using query param ?userId=... to handle IDs with slashes safely
    const res = await fetch(`${API_URL}/payments?userId=${encodeURIComponent(userId)}`, {
        headers: getAuthHeaders()
    });
    return await handleResponse(res);
  },

  createPayment: async (paymentData: any): Promise<Payment> => {
    const res = await fetch(`${API_URL}/payments`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            ...getAuthHeaders() 
        },
        body: JSON.stringify(paymentData)
    });
    return await handleResponse(res);
  },

  updatePaymentStatus: async (paymentId: string, status: 'Successful' | 'Pending' | 'Failed'): Promise<void> => {
    await fetch(`${API_URL}/payments/${encodeURIComponent(paymentId)}`, {
        method: 'PUT',
        headers: { 
            'Content-Type': 'application/json',
            ...getAuthHeaders()
        },
        body: JSON.stringify({ status })
    });
  },

  deletePayment: async (paymentId: string): Promise<void> => {
    await fetch(`${API_URL}/payments/${encodeURIComponent(paymentId)}`, { 
        method: 'DELETE',
        headers: getAuthHeaders() 
    });
  },

  // Configuration
  getBankDetails: async (): Promise<BankDetails> => {
    const res = await fetch(`${API_URL}/config/bank-details`, {
        headers: getAuthHeaders()
    });
    return await handleResponse(res);
  },

  // Messaging
  getConversations: async (userId: string): Promise<User[]> => {
    // Using query param ?userId=...
    const res = await fetch(`${API_URL}/messages/conversations?userId=${encodeURIComponent(userId)}&t=${Date.now()}`, {
        headers: getAuthHeaders()
    });
    return await handleResponse(res);
  },

  getMessages: async (userId: string, otherUserId: string): Promise<Message[]> => {
    // Using query params to handle IDs with slashes
    const res = await fetch(`${API_URL}/messages/chat?userId=${encodeURIComponent(userId)}&otherUserId=${encodeURIComponent(otherUserId)}`, {
        headers: getAuthHeaders()
    });
    return await handleResponse(res);
  },

  sendMessage: async (senderId: string, receiverId: string, content: string): Promise<Message> => {
    const res = await fetch(`${API_URL}/messages`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            ...getAuthHeaders()
        },
        body: JSON.stringify({ senderId, receiverId, content })
    });
    return await handleResponse(res);
  },

  markMessagesRead: async (userId: string, otherUserId: string): Promise<void> => {
    await fetch(`${API_URL}/messages/read`, {
        method: 'PUT',
        headers: { 
            'Content-Type': 'application/json',
            ...getAuthHeaders()
        },
        body: JSON.stringify({ userId, otherUserId })
    });
  },
  
  getUnreadCount: async (userId: string): Promise<number> => {
      try {
          // Using query param ?userId=...
          const res = await fetch(`${API_URL}/messages/unread?userId=${encodeURIComponent(userId)}`, {
              headers: getAuthHeaders()
          });
          if(!res.ok) return 0;
          const data = await res.json();
          return data.count;
      } catch {
          return 0;
      }
  }
};
