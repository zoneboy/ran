import React, { useState, useEffect, useRef } from 'react';
import { User, Message, Conversation } from '../types';
import { api } from '../services/api';
import { Send, User as UserIcon, Loader2, ArrowLeft, MoreVertical, Search, MessageSquare } from 'lucide-react';

interface MessagesProps {
  currentUser: User;
  initialTargetUserId?: string | null;
  navigate?: (page: string) => void;
}

const Messages: React.FC<MessagesProps> = ({ currentUser, initialTargetUserId, navigate }) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(initialTargetUserId || null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [activeContact, setActiveContact] = useState<Conversation | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Poll for updates (live feel without websocket)
  useEffect(() => {
    const interval = setInterval(() => {
        if (currentUser) {
            fetchConversations(false);
            if (activeChatId) {
                fetchMessages(activeChatId, false);
            }
        }
    }, 10000); // Poll every 10 seconds

    return () => clearInterval(interval);
  }, [currentUser, activeChatId]);

  // Initial Load
  useEffect(() => {
    fetchConversations();
  }, [currentUser]);

  // Load chat if target provided initially or switched
  useEffect(() => {
    if (activeChatId) {
      // Find contact info from existing convos or fetch if not present (e.g. coming from directory to new chat)
      const existing = conversations.find(c => c.contactId === activeChatId);
      if (existing) {
          setActiveContact(existing);
      } else if (initialTargetUserId === activeChatId) {
          // If starting new chat from directory, we might not have it in conversation list yet
          // Fetch minimal user info for header (optional, or just rely on IDs for now)
          api.getUser(activeChatId).then(u => {
              if(u) {
                const newConvo: Conversation = {
                    contactId: u.id,
                    contactName: `${u.firstName} ${u.lastName}`,
                    contactBusiness: u.businessName,
                    contactImage: u.profileImage,
                    lastMessage: '',
                    lastMessageDate: new Date().toISOString(),
                    unreadCount: 0
                };
                setActiveContact(newConvo);
              }
          });
      }
      fetchMessages(activeChatId);
    }
  }, [activeChatId]);

  // Scroll to bottom
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchConversations = async (showLoading = true) => {
    if (showLoading) setIsLoadingList(true);
    try {
      const data = await api.getConversations(currentUser.id);
      setConversations(data);
    } catch (error) {
      console.error("Failed to load conversations");
    } finally {
      if (showLoading) setIsLoadingList(false);
    }
  };

  const fetchMessages = async (contactId: string, showLoading = true) => {
    if (showLoading) setIsLoadingChat(true);
    try {
      const data = await api.getChatHistory(currentUser.id, contactId);
      setMessages(data);
      // Mark as read
      await api.markAsRead(currentUser.id, contactId);
    } catch (error) {
      console.error("Failed to load chat");
    } finally {
      if (showLoading) setIsLoadingChat(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChatId) return;

    const tempContent = newMessage;
    setNewMessage('');
    setIsSending(true);

    try {
      await api.sendMessage(currentUser.id, activeChatId, tempContent);
      // Refresh chat immediately
      await fetchMessages(activeChatId, false);
      await fetchConversations(false); // Update list preview
    } catch (error) {
      alert("Failed to send message");
      setNewMessage(tempContent);
    } finally {
      setIsSending(false);
    }
  };

  const formatTime = (dateString: string) => {
      const date = new Date(dateString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
      const date = new Date(dateString);
      return date.toLocaleDateString();
  };

  return (
    <div className="flex h-[calc(100vh-64px)] bg-gray-100 overflow-hidden">
        {/* Sidebar / Conversation List */}
        <div className={`${activeChatId ? 'hidden md:flex' : 'flex'} w-full md:w-80 lg:w-96 flex-col bg-white border-r border-gray-200`}>
            <div className="p-4 border-b border-gray-200 bg-gray-50">
                <h2 className="text-xl font-bold text-gray-800 flex items-center">
                    <MessageSquare className="h-5 w-5 mr-2 text-green-600" /> Messages
                </h2>
                <div className="mt-4 relative">
                    <input 
                        type="text" 
                        placeholder="Search conversations..." 
                        className="w-full pl-10 pr-4 py-2 border rounded-full bg-white focus:ring-green-500 focus:border-green-500 text-sm"
                    />
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto">
                {isLoadingList ? (
                    <div className="flex justify-center p-8"><Loader2 className="animate-spin h-6 w-6 text-green-600"/></div>
                ) : conversations.length === 0 ? (
                    <div className="text-center p-8 text-gray-500">
                        <p>No conversations yet.</p>
                        <p className="text-sm mt-2">Go to Member Directory to start a chat.</p>
                    </div>
                ) : (
                    conversations.map(conv => (
                        <div 
                            key={conv.contactId}
                            onClick={() => setActiveChatId(conv.contactId)}
                            className={`flex items-center p-4 cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-100 ${activeChatId === conv.contactId ? 'bg-green-50 border-green-100' : ''}`}
                        >
                            <div className="relative h-12 w-12 flex-shrink-0">
                                {conv.contactImage ? (
                                    <img src={conv.contactImage} alt="" className="h-full w-full rounded-full object-cover" />
                                ) : (
                                    <div className="h-full w-full rounded-full bg-green-100 flex items-center justify-center text-green-700">
                                        <UserIcon className="h-6 w-6" />
                                    </div>
                                )}
                                {conv.unreadCount > 0 && (
                                    <span className="absolute -top-1 -right-1 h-5 w-5 bg-green-600 text-white text-xs font-bold rounded-full flex items-center justify-center border-2 border-white">
                                        {conv.unreadCount}
                                    </span>
                                )}
                            </div>
                            <div className="ml-4 flex-1 min-w-0">
                                <div className="flex justify-between items-baseline mb-1">
                                    <h3 className="text-sm font-semibold text-gray-900 truncate pr-2">{conv.contactBusiness || conv.contactName}</h3>
                                    <span className="text-xs text-gray-400 flex-shrink-0">{formatDate(conv.lastMessageDate)}</span>
                                </div>
                                <p className={`text-sm truncate ${conv.unreadCount > 0 ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                                    {conv.lastMessage || 'Sent a photo'}
                                </p>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>

        {/* Chat Area */}
        <div className={`${!activeChatId ? 'hidden md:flex' : 'flex'} flex-1 flex-col bg-[#e5ddd5]`}>
            {activeChatId ? (
                <>
                    {/* Chat Header */}
                    <div className="bg-white p-3 px-4 border-b border-gray-200 flex items-center justify-between shadow-sm z-10">
                        <div className="flex items-center">
                            <button onClick={() => setActiveChatId(null)} className="md:hidden mr-3 text-gray-600">
                                <ArrowLeft className="h-6 w-6" />
                            </button>
                            <div className="h-10 w-10 rounded-full overflow-hidden bg-gray-200 mr-3">
                                {activeContact?.contactImage ? (
                                    <img src={activeContact.contactImage} alt="" className="h-full w-full object-cover" />
                                ) : (
                                    <div className="h-full w-full flex items-center justify-center text-gray-500">
                                        <UserIcon className="h-6 w-6" />
                                    </div>
                                )}
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-800">{activeContact?.contactBusiness || 'Loading...'}</h3>
                                <p className="text-xs text-gray-500">{activeContact?.contactName}</p>
                            </div>
                        </div>
                        <button className="text-gray-500 hover:text-gray-700">
                            <MoreVertical className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Chat Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-repeat">
                        {isLoadingChat ? (
                             <div className="flex justify-center mt-10"><Loader2 className="animate-spin text-gray-500" /></div>
                        ) : (
                            messages.map((msg) => {
                                const isMe = msg.senderId === currentUser.id;
                                return (
                                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[75%] rounded-lg px-4 py-2 shadow-sm relative ${
                                            isMe ? 'bg-[#d9fdd3] text-gray-900 rounded-tr-none' : 'bg-white text-gray-900 rounded-tl-none'
                                        }`}>
                                            <p className="text-sm leading-relaxed">{msg.content}</p>
                                            <div className="flex justify-end mt-1 items-center space-x-1">
                                                <span className="text-[10px] text-gray-500">{formatTime(msg.timestamp)}</span>
                                                {isMe && (
                                                    <span className={`text-[10px] ${msg.isRead ? 'text-blue-500' : 'text-gray-400'}`}>
                                                        {msg.isRead ? '✓✓' : '✓'}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <form onSubmit={handleSendMessage} className="bg-white p-3 flex items-center gap-2 border-t border-gray-200">
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Type a message"
                            className="flex-1 border-none rounded-full bg-gray-100 px-4 py-3 focus:ring-1 focus:ring-green-500 focus:outline-none"
                        />
                        <button 
                            type="submit" 
                            disabled={!newMessage.trim() || isSending}
                            className={`p-3 rounded-full text-white transition-colors ${!newMessage.trim() ? 'bg-gray-300' : 'bg-green-600 hover:bg-green-700 shadow-md'}`}
                        >
                            <Send className="h-5 w-5" />
                        </button>
                    </form>
                </>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-500 bg-gray-50 border-b-8 border-green-600">
                    <div className="h-32 w-32 bg-gray-200 rounded-full flex items-center justify-center mb-6">
                        <MessageSquare className="h-16 w-16 text-gray-400" />
                    </div>
                    <h2 className="text-2xl font-light text-gray-600 mb-4">Recyclers Association Messenger</h2>
                    <p>Select a conversation from the sidebar to start chatting.</p>
                </div>
            )}
        </div>
    </div>
  );
};

export default Messages;