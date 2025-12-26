import React, { useState, useEffect, useRef } from 'react';
import { User, Message } from '../types';
import { api } from '../services/api';
import { Send, User as UserIcon, Loader2, ArrowLeft, RefreshCw, MessageSquare, AlertCircle } from 'lucide-react';

interface MessagesProps {
  currentUser: User;
  navigate: (page: string) => void;
  targetUserId?: string | null;
}

const Messages: React.FC<MessagesProps> = ({ currentUser, navigate, targetUserId }) => {
  const [conversations, setConversations] = useState<User[]>([]);
  const [activeChatUser, setActiveChatUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. Fetch Conversations List
  const fetchConversations = async () => {
    setIsLoadingList(true); // Show loading indicator specifically on refresh
    try {
      const users = await api.getConversations(currentUser.id);
      
      // Safety check: ensure users is an array
      if (!Array.isArray(users)) {
          console.error("API returned non-array for conversations:", users);
          setConversations([]);
          return [];
      }

      setConversations(prev => {
         // Merge logic: ensure activeChatUser stays in list even if API delays or they fall off recent list
         if (activeChatUser && !users.find(u => u.id === activeChatUser.id)) {
            // Keep active user at top temporarily if they aren't in the returned list
            return [activeChatUser, ...users];
         }
         return users;
      });
      return users;
    } catch (e) {
      console.error("Failed to fetch conversations", e);
      return [];
    } finally {
      setIsLoadingList(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      // Load initial list without showing loader if we already have data (prevents flickering)
      // but if conversations is empty, we do want to show loader
      if (conversations.length === 0) setIsLoadingList(true);
      
      const users = await api.getConversations(currentUser.id);
      
      if (!mounted) return;
      
      if (Array.isArray(users)) {
          setConversations(users);
      }
      setIsLoadingList(false);

      // Handle "Message" click from Directory (Target User)
      if (targetUserId) {
        // Check if user is already in our list
        const existing = Array.isArray(users) ? users.find(u => u.id === targetUserId) : null;
        
        if (existing) {
          setActiveChatUser(existing);
        } else {
          // New chat: fetch user details separately
          try {
            const target = await api.getUser(targetUserId);
            if (target && mounted) {
              // Add to local list immediately so they appear
              setConversations(prev => [target, ...prev]);
              setActiveChatUser(target);
            }
          } catch (e) {
            console.error("Failed to load target user details", e);
          }
        }
      }
    };
    init();
    
    // Polling for new conversations
    const interval = setInterval(() => {
        // Only background poll if not actively sending
        if (!isSending && mounted) {
             api.getConversations(currentUser.id).then(users => {
                 if (mounted && Array.isArray(users)) setConversations(users);
             }).catch(console.error);
        }
    }, 10000);
    
    return () => {
        mounted = false;
        clearInterval(interval);
    };
  }, [currentUser.id, targetUserId]);


  // 2. Fetch Messages for Active Chat
  useEffect(() => {
    if (!activeChatUser) return;

    const loadMessages = async () => {
      try {
        const msgs = await api.getMessages(currentUser.id, activeChatUser.id);
        setMessages(msgs);
        await api.markMessagesRead(currentUser.id, activeChatUser.id);
      } catch (e) {
        console.error("Failed to load messages");
      }
    };
    loadMessages();

    // Poll for new messages in this chat
    const interval = setInterval(loadMessages, 5000);
    return () => clearInterval(interval);
  }, [activeChatUser, currentUser.id]);


  // Scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);


  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChatUser) return;

    setIsSending(true);
    setError(null);
    const content = newMessage;
    setNewMessage(''); // Optimistic clear

    try {
      const msg = await api.sendMessage(currentUser.id, activeChatUser.id, content);
      setMessages(prev => [...prev, msg]);
      
      // Optimistically update conversation list order (Active user goes to top)
      setConversations(prev => {
          const others = prev.filter(u => u.id !== activeChatUser.id);
          return [activeChatUser, ...others];
      });

    } catch (e: any) {
      setError("Failed to send message.");
      setNewMessage(content); // Restore message
    } finally {
      setIsSending(false);
    }
  };

  const handleUserClick = (user: User) => {
      setActiveChatUser(user);
      // On mobile, UI will automatically switch views due to conditional rendering
  };

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-64px)] bg-gray-100 max-w-7xl mx-auto md:p-6">
      
      {/* Sidebar - Conversation List */}
      <div className={`${activeChatUser ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 bg-white border-r md:rounded-l-lg shadow-sm overflow-hidden h-full`}>
        <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
            <h3 className="font-bold text-gray-700">Conversations</h3>
            <button onClick={fetchConversations} className="text-gray-400 hover:text-green-600 transition-colors" title="Refresh list">
                <RefreshCw className={`h-4 w-4 ${isLoadingList ? 'animate-spin' : ''}`} />
            </button>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {isLoadingList && conversations.length === 0 ? (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin h-6 w-6 text-green-600" /></div>
          ) : conversations.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
                <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-20" />
                <p>No conversations yet.</p>
                <button onClick={() => navigate('member-directory')} className="mt-4 text-green-600 text-sm font-bold hover:underline">
                    Find Members
                </button>
            </div>
          ) : (
            conversations.map(user => (
              <div 
                key={user.id}
                onClick={() => handleUserClick(user)}
                className={`p-4 border-b cursor-pointer hover:bg-gray-50 flex items-center transition-colors ${activeChatUser?.id === user.id ? 'bg-green-50 border-l-4 border-l-green-600' : ''}`}
              >
                 <div className="h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden mr-3 shrink-0">
                    {user.profileImage ? (
                        <img src={user.profileImage} alt="" className="h-full w-full object-cover" />
                    ) : (
                        <UserIcon className="h-5 w-5 text-gray-400" />
                    )}
                 </div>
                 <div className="overflow-hidden">
                    <h4 className="font-bold text-sm text-gray-900 truncate">{user.businessName}</h4>
                    <p className="text-xs text-gray-500 truncate">{user.firstName} {user.lastName}</p>
                 </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className={`${!activeChatUser ? 'hidden md:flex' : 'flex'} flex-col flex-1 bg-white md:rounded-r-lg shadow-sm h-full`}>
        {activeChatUser ? (
            <>
                {/* Chat Header */}
                <div className="p-4 border-b flex items-center bg-gray-50">
                    <button onClick={() => setActiveChatUser(null)} className="md:hidden mr-3 text-gray-600">
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div className="h-8 w-8 bg-gray-200 rounded-full overflow-hidden mr-3">
                        {activeChatUser.profileImage ? (
                             <img src={activeChatUser.profileImage} alt="" className="h-full w-full object-cover" />
                        ) : (
                             <UserIcon className="h-4 w-4 text-gray-400 m-2" />
                        )}
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-800">{activeChatUser.businessName}</h3>
                        <p className="text-xs text-gray-500">{activeChatUser.firstName} {activeChatUser.lastName}</p>
                    </div>
                </div>

                {/* Messages List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
                    {messages.length === 0 && (
                        <div className="text-center text-gray-400 mt-10">
                            <p>No messages yet. Say hello!</p>
                        </div>
                    )}
                    {messages.map(msg => {
                        const isMe = msg.senderId === currentUser.id;
                        return (
                            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] rounded-lg p-3 ${isMe ? 'bg-green-600 text-white rounded-br-none' : 'bg-white border text-gray-800 rounded-bl-none'}`}>
                                    <p className="text-sm">{msg.content}</p>
                                    <p className={`text-[10px] mt-1 text-right ${isMe ? 'text-green-200' : 'text-gray-400'}`}>
                                        {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    </p>
                                </div>
                            </div>
                        )
                    })}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 border-t bg-white">
                    {error && <p className="text-red-500 text-xs mb-2">{error}</p>}
                    <form onSubmit={handleSendMessage} className="flex gap-2">
                        <input 
                            type="text" 
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Type a message..."
                            className="flex-1 border border-gray-300 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                        <button 
                            type="submit" 
                            disabled={isSending || !newMessage.trim()}
                            className="bg-green-600 text-white p-2 rounded-full hover:bg-green-700 disabled:opacity-50"
                        >
                            <Send className="h-5 w-5" />
                        </button>
                    </form>
                </div>
            </>
        ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                <MessageSquare className="h-16 w-16 mb-4 opacity-20" />
                <p>Select a conversation to start chatting.</p>
            </div>
        )}
      </div>

    </div>
  );
};

export default Messages;