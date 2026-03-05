



import { User, Announcement, Payment, Message, BankDetails, Collection, MaterialPrice } from '../types';

// Determine API URL based on environment
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_URL = isLocal 
    ? 'http://localhost:5000/api'  // Local Backend Server
    : '/.netlify/functions/api';   // Production Backend (Netlify Functions)

// In-memory user store (Replaces LocalStorage for security)
// Note: This means session is lost on refresh.
let sessionUser: User | null = null;

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
  login: async (email: string, password?: string): Promise<User | { mfaRequired?: boolean, mfaSetupRequired?: boolean }> => {
    const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include'
    });
    const data = await handleResponse(res);
    
    // Check for MFA instructions
    if (data.mfaRequired || data.mfaSetupRequired) {
        return data;
    }

    // Normal Login Success
    localStorage.setItem('ran_user', JSON.stringify(data));
    sessionUser = data;
    return data;
  },

  setupMfa: async (): Promise<{ secret: string, qrCode: string }> => {
      const res = await fetch(`${API_URL}/auth/mfa/setup`, {
          method: 'POST',
          credentials: 'include'
      });
      return await handleResponse(res);
  },

  confirmMfa: async (token: string, secret: string): Promise<User> => {
      const res = await fetch(`${API_URL}/auth/mfa/confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, secret }),
          credentials: 'include'
      });
      const user = await handleResponse(res);
      localStorage.setItem('ran_user', JSON.stringify(user));
      sessionUser = user;
      return user;
  },

  loginMfa: async (token: string): Promise<User> => {
      const res = await fetch(`${API_URL}/auth/mfa/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
          credentials: 'include'
      });
      const user = await handleResponse(res);
      localStorage.setItem('ran_user', JSON.stringify(user));
      sessionUser = user;
      return user;
  },

  register: async (userData: any): Promise<User> => {
    const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
        credentials: 'include'
    });
    const user = await handleResponse(res);
    // Store non-sensitive user data in localStorage (no token)
    localStorage.setItem('ran_user', JSON.stringify(user));
    sessionUser = user;
    return user;
  },

  resetPassword: async (email: string): Promise<void> => {
    const res = await fetch(`${API_URL}/auth/request-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
        credentials: 'include'
    });
    if (!res.ok) throw new Error('Request failed');
  },

  confirmPasswordReset: async (email: string, token: string, newPassword: string): Promise<void> => {
      const res = await fetch(`${API_URL}/auth/confirm-reset`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, token, newPassword }),
          credentials: 'include'
      });
      await handleResponse(res);
  },

  logout: async () => {
    try {
        await fetch(`${API_URL}/auth/logout`, { 
            method: 'POST',
            credentials: 'include'
        });
    } catch (e) {
        console.error("Logout failed on server", e);
    }
    localStorage.removeItem('ran_user');
    sessionUser = null;
  },

  getCurrentUser: async (): Promise<User | null> => {
    const stored = localStorage.getItem('ran_user');
    return stored ? JSON.parse(stored) : null;
  },

  // User Management
  getUser: async (id: string): Promise<User | null> => {
    // Using query param ?id=... to handle IDs with slashes safely
    const res = await fetch(`${API_URL}/user?id=${encodeURIComponent(id)}`, {
        credentials: 'include'
    });
    if (!res.ok) return null;
    return await res.json();
  },

  getUsers: async (): Promise<User[]> => {
    const res = await fetch(`${API_URL}/users`, {
        credentials: 'include'
    });
    return await handleResponse(res);
  },

  updateUser: async (updatedUser: User): Promise<User> => {
    // Changed to /user/update?id=... to avoid path param issues with slashes
    const res = await fetch(`${API_URL}/user/update?id=${encodeURIComponent(updatedUser.id)}`, {
        method: 'PUT',
        headers: { 
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(updatedUser),
        credentials: 'include'
    });
    const data = await handleResponse(res);
    
    // Update local storage if updating current user
    const currentUser = JSON.parse(localStorage.getItem('ran_user') || '{}');
    if (currentUser.id === data.id) {
       localStorage.setItem('ran_user', JSON.stringify(data));
       return data;
    }
    return data;
  },

  updateUserId: async (currentId: string, newId: string): Promise<void> => {
     const res = await fetch(`${API_URL}/users/update-id`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ currentId, newId }),
        credentials: 'include'
    });
    await handleResponse(res);
  },

  // Announcements
  getAnnouncements: async (): Promise<Announcement[]> => {
    const res = await fetch(`${API_URL}/announcements`, {
        credentials: 'include'
    });
    return await handleResponse(res);
  },

  createAnnouncement: async (announcement: Omit<Announcement, 'id'>): Promise<Announcement> => {
    const res = await fetch(`${API_URL}/announcements`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(announcement),
        credentials: 'include'
    });
    return await handleResponse(res);
  },

  deleteAnnouncement: async (id: string): Promise<void> => {
    await fetch(`${API_URL}/announcements/${encodeURIComponent(id)}`, { 
        method: 'DELETE',
        credentials: 'include'
    });
  },

  // Payments
  getAllPayments: async (): Promise<Payment[]> => {
    const res = await fetch(`${API_URL}/payments`, {
        credentials: 'include'
    });
    return await handleResponse(res);
  },

  getPayments: async (userId: string): Promise<Payment[]> => {
    // Using query param ?userId=... to handle IDs with slashes safely
    const res = await fetch(`${API_URL}/payments?userId=${encodeURIComponent(userId)}`, {
        credentials: 'include'
    });
    return await handleResponse(res);
  },

  createPayment: async (paymentData: any): Promise<Payment> => {
    const res = await fetch(`${API_URL}/payments`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(paymentData),
        credentials: 'include'
    });
    return await handleResponse(res);
  },

  updatePaymentStatus: async (paymentId: string, status: 'Successful' | 'Pending' | 'Failed'): Promise<void> => {
    await fetch(`${API_URL}/payments/${encodeURIComponent(paymentId)}`, {
        method: 'PUT',
        headers: { 
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status }),
        credentials: 'include'
    });
  },

  deletePayment: async (paymentId: string): Promise<void> => {
    await fetch(`${API_URL}/payments/${encodeURIComponent(paymentId)}`, { 
        method: 'DELETE',
        credentials: 'include'
    });
  },

  // Collections
  getCollections: async (userId?: string): Promise<Collection[]> => {
    let url = `${API_URL}/collections`;
    if (userId) {
        url += `?userId=${encodeURIComponent(userId)}`;
    }
    const res = await fetch(url, {
        credentials: 'include'
    });
    return await handleResponse(res);
  },

  createCollection: async (data: Partial<Collection>): Promise<Collection> => {
    const res = await fetch(`${API_URL}/collections`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data),
        credentials: 'include'
    });
    return await handleResponse(res);
  },

  // Configuration
  getBankDetails: async (): Promise<BankDetails> => {
    const res = await fetch(`${API_URL}/config/bank-details`, {
        credentials: 'include'
    });
    return await handleResponse(res);
  },

  // Messaging
  getConversations: async (userId: string): Promise<User[]> => {
    // Using query param ?userId=...
    const res = await fetch(`${API_URL}/messages/conversations?userId=${encodeURIComponent(userId)}&t=${Date.now()}`, {
        credentials: 'include'
    });
    return await handleResponse(res);
  },

  getMessages: async (userId: string, otherUserId: string): Promise<Message[]> => {
    // Using query params to handle IDs with slashes
    const res = await fetch(`${API_URL}/messages/chat?userId=${encodeURIComponent(userId)}&otherUserId=${encodeURIComponent(otherUserId)}`, {
        credentials: 'include'
    });
    return await handleResponse(res);
  },

  sendMessage: async (senderId: string, receiverId: string, content: string): Promise<Message> => {
    const res = await fetch(`${API_URL}/messages`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ senderId, receiverId, content }),
        credentials: 'include'
    });
    return await handleResponse(res);
  },

  markMessagesRead: async (userId: string, otherUserId: string): Promise<void> => {
    await fetch(`${API_URL}/messages/read`, {
        method: 'PUT',
        headers: { 
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId, otherUserId }),
        credentials: 'include'
    });
  },
  
  getUnreadCount: async (userId: string): Promise<number> => {
      try {
          // Using query param ?userId=...
          const res = await fetch(`${API_URL}/messages/unread?userId=${encodeURIComponent(userId)}`, {
              credentials: 'include'
          });
          if(!res.ok) return 0;
          const data = await res.json();
          return data.count;
      } catch {
          return 0;
      }
  },

  // Material Prices
  getPrices: async (): Promise<MaterialPrice[]> => {
    const res = await fetch(`${API_URL}/prices`, {
        credentials: 'include'
    });
    return await handleResponse(res);
  },

  updatePrice: async (id: string, price: number, co2Rate: number): Promise<void> => {
    await fetch(`${API_URL}/prices/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price, co2Rate }),
        credentials: 'include'
    });
  }
};