
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000', // Your backend URL
});

export const getConversations = (userId) => api.get(`/messages/conversations/${userId}`);
export const getMessages = (userId, receiverId) => api.get(`/messages/${userId}/${receiverId}`);
export const sendMessage = (senderId, receiverId, content) => api.post('/messages', { senderId, receiverId, content });

export default api;
    