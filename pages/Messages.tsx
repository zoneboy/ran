
import React, { useState, useEffect, useRef } from 'react';
import { User, Message } from '../types';
import { api } from '../services/api';
import { Send, User as UserIcon, Loader2, ArrowLeft, RefreshCw, MessageSquare } from 'lucide-react';

interface MessagesProps {
  currentUser: User;
  navigate: (page: string) => void;
  targetUserId?: string | null; // Optional prop to jump straight to a chat
}

const Messages: React.FC<MessagesProps> = ({ currentUser, navigate, targetUserId }) => {
  const [conversations, setConversations] = useState<User[]>([]);
  const [activeChatUser, setActiveChatUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initial Load
  useEffect(() => {
    const init = async () => {
      try {
        const users = await api.getConversations(currentUser.id);
        setConversations(users);

        // If targetUserId is provided (from directory), load that chat
        if (targetUserId) {
            // Check if user is in conversations list, if not fetch them
            const existing = users.find(u => u.id === targetUserId);
            if (existing) {
                setActiveChatUser(existing);
            } else {
                const target = await api.getUser(targetUserId);
                if (target) {
                    setConversations(prev => [target, ...prev]);
                    setActiveChatUser(target);
                }
            }
        }
      } catch (e) {
        console.error("Failed to load conversations", e);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, [currentUser.id, targetUserId]);

  // Load Messages when Active Chat Changes
  useEffect(() => {
    if (!activeChatUser) return;
    
    const fetchMessages = async () => {
        setIsRefreshing(true);
        try {
            const msgs = await api.getMessages(currentUser.id, activeChatUser.id);
            setMessages(msgs);
            // Mark read
            await api.markMessagesRead(currentUser.id, activeChatUser.id);
        } catch (e) {
            console.error("Failed to fetch messages");
        } finally {
            setIsRefreshing(false);
        }
    };

    fetchMessages();
    
    // Simple polling for new messages every 10 seconds
    const interval = setInterval(fetchMessages, 10000);
    return () => clearInterval(interval);

  }, [activeChatUser, currentUser.id]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChatUser) return;
    
    const tempContent = newMessage;
    setNewMessage(''); // Optimistic clear
    setIsSending(true);

    try {
        const sentMsg = await api.sendMessage(currentUser.id, activeChatUser.id, tempContent);
        setMessages(prev => [...prev, sentMsg]);
        
        // Update conversations list order if needed
        const convoIndex = conversations.findIndex(u => u.id === activeChatUser.id);
        if (convoIndex > 0) {
            const updatedConvos = [...conversations];
            const [moved] = updatedConvos.splice(convoIndex, 1);
            updatedConvos.unshift(moved);
            setConversations(updatedConvos);
        }
    } catch (e) {
        console.error("Failed to send");
        alert("Failed to send message. Please try again.");
        setNewMessage(tempContent);
    } finally {
        setIsSending(false);
    }
  };

  const manualRefresh = async () => {
    if (!activeChatUser) return;
    setIsRefreshing(true);
    const msgs = await api.getMessages(currentUser.id, activeChatUser.id);
    setMessages(msgs);
    setIsRefreshing(false);
  };

  if (isLoading) {
      return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-10 w-10 text-green-600 animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
       {/* Mobile Header */}
       <div className="md:hidden bg-white p-4 border-b flex items-center justify-between sticky top-0 z-10">
           {activeChatUser ? (
               <button onClick={() => setActiveChatUser(null)} className="flex items-center text-gray-600">
                   <ArrowLeft className="h-5 w-5 mr-2" /> Back
               </button>
           ) : (
               <h1 className="text-xl font-bold text-gray-800">Messages</h1>
           )}
       </div>

       <div className="flex-1 max-w-7xl w-full mx-auto md:p-6 flex md:h-[calc(100vh-64px)] overflow-hidden">
          
          {/* Sidebar / Conversation List */}
          <div className={`${activeChatUser ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 bg-white border-r md:rounded-l-lg shadow-sm overflow-hidden`}>
             <div className="p-4 border-b bg-gray-50 flex justify-between items-center hidden md:flex">
                 <h2 className="font-bold text-gray-700">Inbox</h2>
             </div>
             
             <div className="flex-1 overflow-y-auto">
                 {conversations.length === 0 ? (
                     <div className="p-8 text-center text-gray-500">
                         <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-30" />
                         <p>No conversations yet.</p>
                         <p className="text-xs mt-1">Visit the directory to message a member.</p>
                     </div>
                 ) : (
                     conversations.map(u => (
                         <div 
                           key={u.id}
                           onClick={() => setActiveChatUser(u)}
                           className={`p-4 border-b cursor-pointer hover:bg-green-50 transition-colors flex items-center ${activeChatUser?.id === u.id ? 'bg-green-50 border-l-4 border-l-green-600' : ''}`}
                         >
                            <div className="h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden mr-3 shrink-0">
                                {u.profileImage ? (
                                    <img src={u.profileImage} alt="" className="h-full w-full object-cover" />
                                ) : (
                                    <UserIcon className="h-5 w-5 text-gray-400" />
                                )}
                            </div>
                            <div className="overflow-hidden">
                                <h4 className="font-bold text-sm text-gray-900 truncate">{u.businessName}</h4>
                                <p className="text-xs text-gray-500 truncate">{u.firstName} {u.lastName}</p>
                            </div>
                         </div>
                     ))
                 )}
             </div>
          </div>

          {/* Chat Area */}
          <div className={`${!activeChatUser ? 'hidden md:flex' : 'flex'} flex-col flex-1 bg-white md:rounded-r-lg shadow-sm overflow-hidden`}>
             {activeChatUser ? (
                 <>
                    {/* Chat Header */}
                    <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                        <div className="flex items-center">
                            <div className="h-8 w-8 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden mr-3">
                                {activeChatUser.profileImage ? (
                                    <img src={activeChatUser.profileImage} alt="" className="h-full w-full object-cover" />
                                ) : (
                                    <UserIcon className="h-4 w-4 text-gray-400" />
                                )}
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-800 text-sm md:text-base">{activeChatUser.businessName}</h3>
                                <p className="text-xs text-gray-500">{activeChatUser.firstName} {activeChatUser.lastName}</p>
                            </div>
                        </div>
                        <button onClick={manualRefresh} title="Refresh Messages" className="text-gray-400 hover:text-green-600">
                            <RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
                        </button>
                    </div>

                    {/* Messages List */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                        {messages.length === 0 ? (
                            <div className="text-center text-gray-400 mt-10 text-sm">
                                <p>Start a conversation with {activeChatUser.businessName}.</p>
                                <p className="text-xs">Messages are secure and private.</p>
                            </div>
                        ) : (
                            messages.map((msg) => {
                                const isMe = msg.senderId === currentUser.id;
                                return (
                                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[75%] rounded-lg p-3 ${isMe ? 'bg-green-600 text-white rounded-br-none' : 'bg-white border text-gray-800 rounded-bl-none shadow-sm'}`}>
                                            <p className="text-sm">{msg.content}</p>
                                            <p className={`text-[10px] mt-1 text-right ${isMe ? 'text-green-200' : 'text-gray-400'}`}>
                                                {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                {isMe && msg.isRead && <span className="ml-1">✓✓</span>}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <form onSubmit={handleSendMessage} className="p-4 border-t bg-white flex items-center gap-2">
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
                          className={`p-2 rounded-full bg-green-600 text-white hover:bg-green-700 transition-colors ${isSending ? 'opacity-50' : ''}`}
                        >
                           <Send className="h-5 w-5" />
                        </button>
                    </form>
                 </>
             ) : (
                 <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8">
                     <MessageSquare className="h-16 w-16 mb-4 opacity-20" />
                     <p className="text-lg">Select a conversation from the sidebar</p>
                     <p className="text-sm">or find a member in the directory to message.</p>
                 </div>
             )}
          </div>
       </div>
    </div>
  );
};

export default Messages;
