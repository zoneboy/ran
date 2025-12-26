import { User, Announcement, Payment, Message, MembershipStatus } from '../types';
import { MOCK_USERS, MOCK_ANNOUNCEMENTS, MOCK_PAYMENTS } from './mockData';
// @ts-ignore
import bcrypt from 'bcryptjs';

// CONFIGURATION
// Set this to false when backend/server.js is running
const USE_MOCK_BACKEND = true; 
const API_URL = 'http://localhost:5000/api';

// Helper for delays
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Local Storage Keys
const USERS_KEY = 'ran_users';
const CURRENT_USER_KEY = 'ran_user';
const ANNOUNCEMENTS_KEY = 'ran_announcements';
const PAYMENTS_KEY = 'ran_payments';
const MESSAGES_KEY = 'ran_messages';

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
  
  // If storage is empty or deleted, restore default MOCK_USERS immediately
  if (!stored || JSON.parse(stored).length === 0) {
    console.log('Database empty or missing. Restoring Default Mock Data (Admin & Users)...');
    
    // Sync hash for initialization
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync('password123', salt);
    
    // Create default users with hashed passwords
    const usersWithPassword = MOCK_USERS.map(u => ({...u, password: hash}));
    
    // Save to local storage
    try {
        localStorage.setItem(USERS_KEY, JSON.stringify(usersWithPassword));
    } catch (e) {
        console.error("Storage full during initialization");
    }
    return usersWithPassword;
  }
  
  return JSON.parse(stored);
};

// Helper: Get announcements from storage, or RESTORE defaults if missing
const getStoredAnnouncements = () => {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(ANNOUNCEMENTS_KEY);
  
  if (!stored) {
    localStorage.setItem(ANNOUNCEMENTS_KEY, JSON.stringify(MOCK_ANNOUNCEMENTS));
    return MOCK_ANNOUNCEMENTS;
  }
  return JSON.parse(stored);
};

// Helper: Get payments from storage, or RESTORE defaults
const getStoredPayments = () => {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(PAYMENTS_KEY);

  if (!stored) {
    localStorage.setItem(PAYMENTS_KEY, JSON.stringify(MOCK_PAYMENTS));
    return MOCK_PAYMENTS;
  }
  return JSON.parse(stored);
};

// Helper: Get messages from storage
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
                 throw new Error(`Endpoint not found (404). The backend function is not reachable at ${API_URL}.`);
            }
            throw new Error(`Server Error: ${res.status} ${res.statusText}. The backend might be starting up or unreachable.`);
        }
    }
    return res.json();
};

// Initialize on load just in case
getStoredUsers();
getStoredAnnouncements();
getStoredPayments();

export const api = {
  // Authentication
  login: async (email: string, password?: string): Promise<User> => {
    if (USE_MOCK_BACKEND) {
      await delay(800);
      
      // Use helper to get users (will auto-restore if missing)
      const users: any[] = getStoredUsers();
      
      let user = users.find(u => u.email === email);
      if (!user) throw new Error('Invalid email or password');

      // Check for auto-expiration logic on login
      const updatedUser = checkAndExpireUser(user);
      
      // If status changed due to expiration, save it back to DB
      if (updatedUser.status !== user.status) {
         user = updatedUser;
         const index = users.findIndex(u => u.id === user.id);
         users[index] = user;
         localStorage.setItem(USERS_KEY, JSON.stringify(users));
      }

      // 1. Check Status
      if (user.status === 'Pending') {
        throw new Error('Your account is currently pending approval. Please wait for admin confirmation.');
      }
      if (user.status === 'Suspended') {
        throw new Error('Your account has been suspended. Please contact support.');
      }
      if (user.status === 'Expired') {
        throw new Error('Your membership has expired. Login is restricted. Please contact the secretariat to renew.');
      }

      // 2. Check Password
      if (password) {
          // Try bcrypt compare
          let isMatch = false;
          try {
            isMatch = await bcrypt.compare(password, user.password);
          } catch (e) {
            console.warn('Bcrypt compare failed, checking plain text fallback');
          }

          // Fallback for legacy plain text passwords (development convenience)
          if (!isMatch && user.password === password) {
             isMatch = true;
          }

          if (!isMatch) throw new Error('Invalid email or password');
      }

      // Remove password before returning/storing in session
      const { password: _, ...safeUser } = user;
      
      try {
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(safeUser));
      } catch (e: any) {
        console.warn('Storage quota exceeded. Attempting to store lean user session.');
        
        // Strategy 1: Remove Profile Image
        try {
            const { profileImage, ...leanUser } = safeUser;
            localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(leanUser));
            return leanUser as User;
        } catch (e2) {
             // Strategy 2: Remove Documents AND Profile Image
             try {
                 const { profileImage, documents, ...leanerUser } = safeUser;
                 localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(leanerUser));
                 return leanerUser as User;
             } catch (e3) {
                 // Strategy 3: Minimal Session
                 const minimalUser = {
                    id: safeUser.id,
                    firstName: safeUser.firstName,
                    lastName: safeUser.lastName,
                    email: safeUser.email,
                    role: safeUser.role,
                    status: safeUser.status,
                    businessName: safeUser.businessName
                 };
                 try {
                    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(minimalUser));
                    return minimalUser as any;
                 } catch (e4) {
                    throw new Error("Login failed: Storage completely full. Please clear browser cache.");
                 }
             }
        }
      }
      return safeUser as User;
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
    if (USE_MOCK_BACKEND) {
      await delay(1200);
      const users: any[] = getStoredUsers();
      
      // Check for multiple registration of already registered email
      if (users.some(u => u.email === userData.email)) {
        throw new Error('User with this email already exists');
      }

      // Hash the password before saving
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(userData.password || 'password123', salt);

      const newUser = {
        ...userData,
        id: `user-${Date.now()}`,
        role: 'MEMBER',
        status: 'Pending', // Default status is Pending
        category: userData.category || userData.membershipCategory,
        profileImage: userData.profileImage || userData.portraitImage, 
        dateJoined: new Date().toISOString().split('T')[0],
        expiryDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
        materialTypes: userData.materialTypes || [],
        machineryDeployed: userData.machineryDeployed || [],
        password: hashedPassword 
      };
      
      users.push(newUser);
      try {
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
      } catch (e: any) {
        if (e.name === 'QuotaExceededError') {
             throw new Error('Storage Full: Please use a smaller profile picture or clear your browser cache.');
        }
        throw e;
      }
      
      const { password, ...safeUser } = newUser;
      return safeUser as User;
    } else {
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
    }
  },

  resetPassword: async (email: string): Promise<void> => {
    if (USE_MOCK_BACKEND) {
        await delay(1000);
        return;
    } else {
        await delay(500);
        return;
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
    if (USE_MOCK_BACKEND) {
        await delay(200);
        const users = getStoredUsers();
        let found = users.find((u: any) => u.id === id);
        if (found) {
            // Check expiry
            const updated = checkAndExpireUser(found);
            if (updated.status !== found.status) {
                // We should theoretically save this back, but for getSingle user, 
                // returning the dynamic status is sufficient for UI
                found = updated;
            }
            const { password, ...safeUser } = found;
            return safeUser as User;
        }
        return null;
    } else {
        const res = await fetch(`${API_URL}/users/${id}`);
        if (!res.ok) return null;
        return await res.json();
    }
  },

  getUsers: async (): Promise<User[]> => {
    if (USE_MOCK_BACKEND) {
      await delay(500);
      const users: any[] = getStoredUsers();
      
      // Check expiration for all users on fetch
      let changed = false;
      const updatedUsers = users.map((u: any) => {
          const processed = checkAndExpireUser(u);
          if (processed.status !== u.status) changed = true;
          return processed;
      });

      if (changed) {
          localStorage.setItem(USERS_KEY, JSON.stringify(updatedUsers));
      }

      return updatedUsers.map(({ password, ...u }: any) => u) as User[];
    } else {
      const res = await fetch(`${API_URL}/users`);
      return await res.json();
    }
  },

  updateUser: async (updatedUser: User): Promise<User> => {
    if (USE_MOCK_BACKEND) {
      await delay(600);
      const users: any[] = getStoredUsers();
      const index = users.findIndex(u => u.id === updatedUser.id);
      
      if (index !== -1) {
        const existingPassword = users[index].password;
        users[index] = { ...updatedUser, password: existingPassword };
        
        try {
            localStorage.setItem(USERS_KEY, JSON.stringify(users));
        } catch (e: any) {
            if (e.name === 'QuotaExceededError') {
                throw new Error('Failed to save: Image too large. Please use a smaller image.');
            }
        }
        
        // Update session user if it's the current user
        const currentUser = JSON.parse(localStorage.getItem(CURRENT_USER_KEY) || '{}');
        if (currentUser.id === updatedUser.id) {
          try {
             localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updatedUser));
          } catch(e: any) {
             // If session full, try saving without heavy fields
             const { profileImage, documents, ...leanUser } = updatedUser;
             try {
                localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(leanUser));
             } catch(e2) {
                console.warn("Could not update session storage due to quota");
             }
          }
        }
      }
      return updatedUser;
    } else {
      const res = await fetch(`${API_URL}/users/${updatedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedUser)
      });
      const data = await res.json();
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(data));
      return data;
    }
  },

  // Assign Custom User ID
  updateUserId: async (currentId: string, newId: string): Promise<void> => {
    if (USE_MOCK_BACKEND) {
        await delay(500);
        const users = getStoredUsers();
        
        // Check if new ID is already taken (excluding self)
        if (users.some((u: any) => u.id === newId && u.id !== currentId)) {
            throw new Error(`User ID '${newId}' is already assigned to another member.`);
        }
        
        const userIndex = users.findIndex((u: any) => u.id === currentId);
        if (userIndex === -1) throw new Error("User not found.");
        
        // 1. Update User ID in Users Array
        users[userIndex].id = newId;
        
        try {
            localStorage.setItem(USERS_KEY, JSON.stringify(users));
        } catch (e) {
            throw new Error('Storage full. Cannot save ID update.');
        }

        // 2. Update Foreign Keys (Payments & Messages) to maintain history
        const payments = getStoredPayments();
        let paymentsChanged = false;
        const updatedPayments = payments.map((p: Payment) => {
            if (p.userId === currentId) {
                paymentsChanged = true;
                return { ...p, userId: newId };
            }
            return p;
        });

        if (paymentsChanged) {
            localStorage.setItem(PAYMENTS_KEY, JSON.stringify(updatedPayments));
        }

        const messages = getStoredMessages();
        let messagesChanged = false;
        const updatedMessages = messages.map((m: Message) => {
            let changed = false;
            let newMsg = { ...m };
            if (m.senderId === currentId) {
                newMsg.senderId = newId;
                changed = true;
            }
            if (m.receiverId === currentId) {
                newMsg.receiverId = newId;
                changed = true;
            }
            if (changed) {
                messagesChanged = true;
                return newMsg;
            }
            return m;
        });
        
        if (messagesChanged) {
            localStorage.setItem(MESSAGES_KEY, JSON.stringify(updatedMessages));
        }

        // 3. Update Session if Admin changed their own ID
        const currentUser = JSON.parse(localStorage.getItem(CURRENT_USER_KEY) || '{}');
        if (currentUser && currentUser.id === currentId) {
            currentUser.id = newId;
            localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(currentUser));
        }

        return;
    }
  },

  // Announcements CRUD
  getAnnouncements: async (): Promise<Announcement[]> => {
    if (USE_MOCK_BACKEND) {
      await delay(300);
      return getStoredAnnouncements();
    }
    const res = await fetch(`${API_URL}/announcements`);
    return await res.json();
  },

  createAnnouncement: async (announcement: Omit<Announcement, 'id'>): Promise<Announcement> => {
    if (USE_MOCK_BACKEND) {
      await delay(500);
      const current = getStoredAnnouncements();
      const newAnnouncement = {
        ...announcement,
        id: `ann-${Date.now()}`
      };
      // Add to beginning of array
      const updated = [newAnnouncement, ...current];
      localStorage.setItem(ANNOUNCEMENTS_KEY, JSON.stringify(updated));
      return newAnnouncement;
    }
    // Backend implementation would go here
    return {} as Announcement;
  },

  deleteAnnouncement: async (id: string): Promise<void> => {
    if (USE_MOCK_BACKEND) {
      await delay(300);
      const current = getStoredAnnouncements();
      // Filter out the item to delete
      const updated = current.filter((a: Announcement) => a.id !== id);
      // Explicitly save the updated array
      localStorage.setItem(ANNOUNCEMENTS_KEY, JSON.stringify(updated));
      return;
    } else {
       // Placeholder for real backend deletion
       await fetch(`${API_URL}/announcements/${id}`, { method: 'DELETE' });
    }
  },

  // Payments
  getAllPayments: async (): Promise<Payment[]> => {
    if (USE_MOCK_BACKEND) {
        return getStoredPayments();
    }
    const res = await fetch(`${API_URL}/payments`);
    return await handleResponse(res);
  },

  getPayments: async (userId: string): Promise<Payment[]> => {
    if (USE_MOCK_BACKEND) {
        const payments = getStoredPayments();
        return payments.filter((p: Payment) => p.userId === userId);
    }
    const res = await fetch(`${API_URL}/payments/${userId}`);
    return await res.json();
  },

  createPayment: async (paymentData: { 
    userId: string, 
    amount: number, 
    description: string,
    date?: string,
    status?: 'Successful' | 'Pending' | 'Failed',
    receipt?: string
  }): Promise<Payment> => {
    if (USE_MOCK_BACKEND) {
      await delay(800);
      const payments = getStoredPayments();
      
      const newPayment: Payment = {
        id: `pay-${Date.now()}`,
        userId: paymentData.userId,
        amount: paymentData.amount,
        currency: 'NGN',
        date: paymentData.date || new Date().toISOString().split('T')[0],
        description: paymentData.description,
        status: paymentData.status || 'Successful', 
        reference: `REF-${Math.floor(Math.random() * 1000000)}`,
        receipt: paymentData.receipt
      };

      const updatedPayments = [newPayment, ...payments];
      try {
        localStorage.setItem(PAYMENTS_KEY, JSON.stringify(updatedPayments));
      } catch (e: any) {
        if (e.name === 'QuotaExceededError') {
             throw new Error('Storage Full: Receipt file might be too large. Try a smaller file.');
        }
        throw e;
      }
      return newPayment;
    }
    return {} as Payment;
  },

  updatePaymentStatus: async (paymentId: string, status: 'Successful' | 'Pending' | 'Failed'): Promise<void> => {
    if (USE_MOCK_BACKEND) {
        await delay(400);
        const payments = getStoredPayments();
        const index = payments.findIndex((p: Payment) => p.id === paymentId);
        
        if (index !== -1) {
            payments[index].status = status;
            localStorage.setItem(PAYMENTS_KEY, JSON.stringify(payments));
        }
        return;
    }
    // Backend impl
    await fetch(`${API_URL}/payments/${encodeURIComponent(paymentId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
    });
  },

  deletePayment: async (paymentId: string): Promise<void> => {
    if (USE_MOCK_BACKEND) {
        await delay(300);
        const payments = getStoredPayments();
        // Keep everything EXCEPT the one to delete
        const updated = payments.filter((p: Payment) => p.id !== paymentId);
        
        // Ensure we are saving a valid array back
        if (Array.isArray(updated)) {
            localStorage.setItem(PAYMENTS_KEY, JSON.stringify(updated));
        }
        return;
    } else {
        await fetch(`${API_URL}/payments/${paymentId}`, { method: 'DELETE' });
    }
  },

  // Messaging
  getConversations: async (userId: string): Promise<User[]> => {
    if (USE_MOCK_BACKEND) {
        await delay(300);
        const messages: Message[] = getStoredMessages();
        const users = getStoredUsers();
        
        // Find unique interactors
        const interactedUserIds = new Set<string>();
        messages.forEach(msg => {
            if (msg.senderId === userId) interactedUserIds.add(msg.receiverId);
            if (msg.receiverId === userId) interactedUserIds.add(msg.senderId);
        });

        // Map to User objects
        return Array.from(interactedUserIds)
            .map(id => users.find((u: User) => u.id === id))
            .filter((u): u is User => !!u);
    }
    const res = await fetch(`${API_URL}/messages/conversations/${encodeURIComponent(userId)}`);
    return await handleResponse(res);
  },

  getMessages: async (userId: string, otherUserId: string): Promise<Message[]> => {
    if (USE_MOCK_BACKEND) {
        await delay(200);
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
        await delay(300);
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
            // Mark read if I am the receiver (userId) and it was sent by other person
            if (msg.receiverId === userId && msg.senderId === otherUserId && !msg.isRead) {
                changed = true;
                return { ...msg, isRead: true };
            }
            return msg;
        });
        if (changed) {
            localStorage.setItem(MESSAGES_KEY, JSON.stringify(updated));
        }
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