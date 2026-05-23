import { User, Announcement, Payment, Message, BankDetails, Collection, MaterialPrice, ProcessedMaterial, StockpileEntry } from '../types';

const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_URL = isLocal 
    ? 'http://localhost:5000/api'
    : '/.netlify/functions/api';

let sessionUser: User | null = null;

const handleResponse = async (res: Response) => {
    if (!res.ok) {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            const errorData = await res.json();
            throw new Error(errorData.message || 'Request failed');
        } else {
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
  login: async (email: string, password?: string): Promise<User | { mfaRequired?: boolean, mfaSetupRequired?: boolean }> => {
    const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include'
    });
    const data = await handleResponse(res);
    if (data.mfaRequired || data.mfaSetupRequired) {
        return data;
    }
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

  getUser: async (id: string): Promise<User | null> => {
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
    const res = await fetch(`${API_URL}/user/update?id=${encodeURIComponent(updatedUser.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedUser),
        credentials: 'include'
    });
    const data = await handleResponse(res);
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentId, newId }),
        credentials: 'include'
    });
    await handleResponse(res);
  },

  getAnnouncements: async (): Promise<Announcement[]> => {
    const res = await fetch(`${API_URL}/announcements`, {
        credentials: 'include'
    });
    return await handleResponse(res);
  },

  createAnnouncement: async (announcement: Omit<Announcement, 'id'>): Promise<Announcement> => {
    const res = await fetch(`${API_URL}/announcements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  getAllPayments: async (): Promise<Payment[]> => {
    const res = await fetch(`${API_URL}/payments`, {
        credentials: 'include'
    });
    return await handleResponse(res);
  },

  getPayments: async (userId: string): Promise<Payment[]> => {
    const res = await fetch(`${API_URL}/payments?userId=${encodeURIComponent(userId)}`, {
        credentials: 'include'
    });
    return await handleResponse(res);
  },

  createPayment: async (paymentData: any): Promise<Payment> => {
    const res = await fetch(`${API_URL}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentData),
        credentials: 'include'
    });
    return await handleResponse(res);
  },

  updatePaymentStatus: async (paymentId: string, status: 'Successful' | 'Pending' | 'Failed'): Promise<void> => {
    await fetch(`${API_URL}/payments/${encodeURIComponent(paymentId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include'
    });
    return await handleResponse(res);
  },

  getProcessedMaterials: async (userId?: string): Promise<ProcessedMaterial[]> => {
    let url = `${API_URL}/processed`;
    if (userId) {
        url += `?userId=${encodeURIComponent(userId)}`;
    }
    const res = await fetch(url, {
        credentials: 'include'
    });
    return await handleResponse(res);
  },

  createProcessedMaterial: async (data: Partial<ProcessedMaterial>): Promise<ProcessedMaterial> => {
    const res = await fetch(`${API_URL}/processed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include'
    });
    return await handleResponse(res);
  },

  getStockpile: async (userId?: string): Promise<StockpileEntry[]> => {
    let url = `${API_URL}/stockpile`;
    if (userId) {
        url += `?userId=${encodeURIComponent(userId)}`;
    }
    const res = await fetch(url, {
        credentials: 'include'
    });
    return await handleResponse(res);
  },

  getBankDetails: async (): Promise<BankDetails> => {
    const res = await fetch(`${API_URL}/config/bank-details`, {
        credentials: 'include'
    });
    return await handleResponse(res);
  },

  getConversations: async (userId: string): Promise<User[]> => {
    const res = await fetch(`${API_URL}/messages/conversations?userId=${encodeURIComponent(userId)}&t=${Date.now()}`, {
        credentials: 'include'
    });
    return await handleResponse(res);
  },

  getMessages: async (userId: string, otherUserId: string): Promise<Message[]> => {
    const res = await fetch(`${API_URL}/messages/chat?userId=${encodeURIComponent(userId)}&otherUserId=${encodeURIComponent(otherUserId)}`, {
        credentials: 'include'
    });
    return await handleResponse(res);
  },

  sendMessage: async (senderId: string, receiverId: string, content: string): Promise<Message> => {
    const res = await fetch(`${API_URL}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senderId, receiverId, content }),
        credentials: 'include'
    });
    return await handleResponse(res);
  },

  markMessagesRead: async (userId: string, otherUserId: string): Promise<void> => {
    await fetch(`${API_URL}/messages/read`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, otherUserId }),
        credentials: 'include'
    });
  },
  
  getUnreadCount: async (userId: string): Promise<number> => {
      try {
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
  },

  getListings: async (filters?: { type?: string; material?: string; state?: string; status?: string; search?: string; scope?: string }): Promise<any[]> => {
    const params = new URLSearchParams();
    if (filters) {
        Object.entries(filters).forEach(([k, v]) => {
            if (v) params.append(k, v);
        });
    }
    const res = await fetch(`${API_URL}/listings?${params.toString()}`, { credentials: 'include' });
    return await handleResponse(res);
  },

  getListing: async (id: string): Promise<any> => {
    const res = await fetch(`${API_URL}/listings/${encodeURIComponent(id)}`, { credentials: 'include' });
    return await handleResponse(res);
  },

  createListing: async (data: any): Promise<any> => {
    const res = await fetch(`${API_URL}/listings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include'
    });
    return await handleResponse(res);
  },

  updateListing: async (id: string, data: any): Promise<any> => {
    const res = await fetch(`${API_URL}/listings/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include'
    });
    return await handleResponse(res);
  },

  closeListing: async (id: string): Promise<any> => {
    const res = await fetch(`${API_URL}/listings/${encodeURIComponent(id)}/close`, {
        method: 'POST',
        credentials: 'include'
    });
    return await handleResponse(res);
  },

  deleteListing: async (id: string): Promise<any> => {
    const res = await fetch(`${API_URL}/listings/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'include'
    });
    return await handleResponse(res);
  },
};