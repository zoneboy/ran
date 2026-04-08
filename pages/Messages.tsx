import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User, Message } from '../types';
import { api } from '../services/api';
import { Send, User as UserIcon, Loader2, ArrowLeft, RefreshCw, MessageSquare, ChevronDown, Check, CheckCheck } from 'lucide-react';
import DOMPurify from 'dompurify';

interface MessagesProps {
  currentUser: User;
  navigate: (page: string) => void;
  targetUserId?: string | null;
}

// --- HELPERS ---

const sanitizeMessage = (content: string): string => {
    let clean = DOMPurify.sanitize(content, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
    clean = clean.replace(/javascript:/gi, 'blocked:');
    if (clean.length > 5000) clean = clean.substring(0, 5000) + '... [truncated]';
    return clean;
};

const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const getDateLabel = (timestamp: string): string => {
    const msgDate = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const strip = (d: Date) => { d.setHours(0, 0, 0, 0); return d; };
    strip(msgDate); strip(today); strip(yesterday);

    if (msgDate.getTime() === today.getTime()) return 'Today';
    if (msgDate.getTime() === yesterday.getTime()) return 'Yesterday';

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 6);
    strip(oneWeekAgo);

    if (msgDate >= oneWeekAgo) {
        return new Date(timestamp).toLocaleDateString([], { weekday: 'long' });
    }

    return new Date(timestamp).toLocaleDateString([], {
        day: 'numeric',
        month: 'long',
        year: msgDate.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    });
};

const groupMessagesByDate = (messages: Message[]): { label: string; messages: Message[] }[] => {
    const groups: { label: string; messages: Message[] }[] = [];
    let currentLabel = '';

    for (const msg of messages) {
        const label = getDateLabel(msg.timestamp);
        if (label !== currentLabel) {
            currentLabel = label;
            groups.push({ label, messages: [msg] });
        } else {
            groups[groups.length - 1].messages.push(msg);
        }
    }
    return groups;
};


// --- COMPONENTS ---

const DateSeparator: React.FC<{ label: string }> = ({ label }) => (
    <div className="flex items-center justify-center my-3">
        <div className="bg-white bg-opacity-90 text-gray-500 text-[11px] font-medium px-3 py-1 rounded-lg shadow-sm border border-gray-100 select-none">
            {label}
        </div>
    </div>
);

const ChatBubble: React.FC<{
    msg: Message;
    isMe: boolean;
    showTail: boolean;
}> = ({ msg, isMe, showTail }) => {
    return (
        <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-[2px] ${showTail ? 'mt-1' : ''}`}>
            <div className="relative max-w-[75%] sm:max-w-[65%]">
                {/* Bubble tail */}
                {showTail && (
                    <div
                        className={`absolute top-0 w-3 h-3 overflow-hidden ${
                            isMe ? '-right-1.5' : '-left-1.5'
                        }`}
                    >
                        <div
                            className={`w-3 h-3 transform rotate-45 ${
                                isMe ? 'bg-green-100 -translate-x-1.5' : 'bg-white -translate-x-0 translate-x-1.5'
                            }`}
                            style={{ marginTop: '2px' }}
                        />
                    </div>
                )}

                <div
                    className={`relative px-2.5 py-1.5 shadow-sm ${
                        isMe
                            ? `bg-green-100 ${showTail ? 'rounded-tl-lg rounded-bl-lg rounded-br-lg' : 'rounded-lg'}`
                            : `bg-white ${showTail ? 'rounded-tr-lg rounded-bl-lg rounded-br-lg' : 'rounded-lg'}`
                    }`}
                >
                    <p className="text-[14.5px] text-gray-800 leading-[20px] whitespace-pre-wrap break-words pr-16">
                        {sanitizeMessage(msg.content)}
                    </p>

                    {/* Time + read receipt */}
                    <div className={`flex items-center justify-end gap-1 -mt-3 float-right ml-2 relative top-[2px]`}>
                        <span className={`text-[10.5px] ${isMe ? 'text-gray-400' : 'text-gray-400'} select-none leading-none`}>
                            {formatTime(msg.timestamp)}
                        </span>
                        {isMe && (
                            msg.isRead
                                ? <CheckCheck className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                : <Check className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};


const ScrollToBottomButton: React.FC<{ onClick: () => void; unreadBelow: number }> = ({ onClick, unreadBelow }) => (
    <button
        onClick={onClick}
        className="absolute bottom-20 right-4 z-20 bg-white text-gray-600 shadow-lg rounded-full p-2 hover:bg-gray-50 transition-all border border-gray-200 group"
        title="Scroll to bottom"
    >
        <ChevronDown className="h-5 w-5 group-hover:translate-y-0.5 transition-transform" />
        {unreadBelow > 0 && (
            <span className="absolute -top-2 -right-1 bg-green-500 text-white text-[10px] font-bold rounded-full h-5 min-w-[20px] flex items-center justify-center px-1">
                {unreadBelow}
            </span>
        )}
    </button>
);


// --- MAIN COMPONENT ---

const Messages: React.FC<MessagesProps> = ({ currentUser, navigate, targetUserId }) => {
    const [conversations, setConversations] = useState<User[]>([]);
    const [activeChatUser, setActiveChatUser] = useState<User | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [isLoadingList, setIsLoadingList] = useState(true);
    const [isLoadingChat, setIsLoadingChat] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Scroll state
    const [showScrollBtn, setShowScrollBtn] = useState(false);
    const [newMessagesBelow, setNewMessagesBelow] = useState(0);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const isUserAtBottomRef = useRef(true);
    const isInitialLoadRef = useRef(true);
    const prevMessageCountRef = useRef(0);

    // Auto-resize textarea
    useEffect(() => {
        const el = textareaRef.current;
        if (el) {
            el.style.height = '40px';
            const newHeight = Math.min(el.scrollHeight, 112);
            el.style.height = newHeight + 'px';
            el.style.overflow = newHeight >= 112 ? 'auto' : 'hidden';
        }
    }, [newMessage]);

    // --- Scroll helpers ---
    const isAtBottom = useCallback(() => {
        const el = chatContainerRef.current;
        if (!el) return true;
        return el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    }, []);

    const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
        const el = chatContainerRef.current;
        if (el) {
            el.scrollTo({ top: el.scrollHeight, behavior });
            setShowScrollBtn(false);
            setNewMessagesBelow(0);
        }
    }, []);

    const handleScroll = useCallback(() => {
        const atBottom = isAtBottom();
        isUserAtBottomRef.current = atBottom;
        setShowScrollBtn(!atBottom);
        if (atBottom) setNewMessagesBelow(0);
    }, [isAtBottom]);

    // --- Fetch conversations ---
    useEffect(() => {
        let mounted = true;

        const init = async () => {
            if (conversations.length === 0) setIsLoadingList(true);

            const users = await api.getConversations(currentUser.id);
            if (!mounted) return;

            if (Array.isArray(users)) setConversations(users);
            setIsLoadingList(false);

            if (targetUserId) {
                const existing = Array.isArray(users) ? users.find(u => u.id === targetUserId) : null;
                if (existing) {
                    setActiveChatUser(existing);
                } else {
                    try {
                        const target = await api.getUser(targetUserId);
                        if (target && mounted) {
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

        const interval = setInterval(() => {
            if (!isSending && mounted) {
                api.getConversations(currentUser.id).then(users => {
                    if (mounted && Array.isArray(users)) setConversations(users);
                }).catch(console.error);
            }
        }, 10000);

        return () => { mounted = false; clearInterval(interval); };
    }, [currentUser.id, targetUserId]);

    // --- Fetch messages for active chat ---
    useEffect(() => {
        if (!activeChatUser) return;
        let mounted = true;

        isInitialLoadRef.current = true;
        prevMessageCountRef.current = 0;
        setIsLoadingChat(true);

        const loadMessages = async () => {
            try {
                const msgs = await api.getMessages(currentUser.id, activeChatUser.id);
                if (!mounted) return;

                const prevCount = prevMessageCountRef.current;
                const isInitial = isInitialLoadRef.current;

                setMessages(msgs);
                prevMessageCountRef.current = msgs.length;

                if (isInitial) {
                    // On first load: scroll to bottom instantly, then mark as loaded
                    isInitialLoadRef.current = false;
                    setIsLoadingChat(false);
                    // Use requestAnimationFrame to wait for DOM render
                    requestAnimationFrame(() => {
                        scrollToBottom('instant' as ScrollBehavior);
                    });
                } else {
                    // Subsequent polls: only scroll if user is at bottom
                    const newCount = msgs.length - prevCount;
                    if (newCount > 0 && !isUserAtBottomRef.current) {
                        setNewMessagesBelow(prev => prev + newCount);
                    } else if (newCount > 0 && isUserAtBottomRef.current) {
                        requestAnimationFrame(() => scrollToBottom('smooth'));
                    }
                }

                await api.markMessagesRead(currentUser.id, activeChatUser.id);
            } catch (e) {
                console.error("Failed to load messages");
            }
        };

        loadMessages();
        const interval = setInterval(loadMessages, 10000);
        return () => { mounted = false; clearInterval(interval); };
    }, [activeChatUser, currentUser.id, scrollToBottom]);

    // --- Send message ---
    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !activeChatUser) return;

        setIsSending(true);
        setError(null);
        const content = newMessage;
        setNewMessage('');

        try {
            const msg = await api.sendMessage(currentUser.id, activeChatUser.id, content);
            setMessages(prev => [...prev, msg]);
            prevMessageCountRef.current += 1;

            // Always scroll to bottom when sending own message
            requestAnimationFrame(() => scrollToBottom('smooth'));

            setConversations(prev => {
                const others = prev.filter(u => u.id !== activeChatUser.id);
                return [activeChatUser, ...others];
            });
        } catch (e: any) {
            setError("Failed to send message.");
            setNewMessage(content);
        } finally {
            setIsSending(false);
        }
    };

    const handleUserClick = (user: User) => {
        setActiveChatUser(user);
        setMessages([]);
        setShowScrollBtn(false);
        setNewMessagesBelow(0);
    };

    // --- Render ---
    const messageGroups = groupMessagesByDate(messages);

    return (
        <div className="flex flex-col md:flex-row h-[calc(100vh-64px)] bg-gray-100 max-w-7xl mx-auto md:p-4">

            {/* ===== SIDEBAR ===== */}
            <div className={`${activeChatUser ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 bg-white border-r md:rounded-l-xl shadow-sm overflow-hidden h-full`}>
                <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
                    <h3 className="font-bold text-gray-700 text-[15px]">Chats</h3>
                    <button
                        onClick={() => {
                            setIsLoadingList(true);
                            api.getConversations(currentUser.id).then(users => {
                                if (Array.isArray(users)) setConversations(users);
                            }).catch(console.error).finally(() => setIsLoadingList(false));
                        }}
                        className="text-gray-400 hover:text-green-600 transition-colors p-1 rounded-full hover:bg-gray-100"
                        title="Refresh"
                    >
                        <RefreshCw className={`h-4 w-4 ${isLoadingList ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {isLoadingList && conversations.length === 0 ? (
                        <div className="flex justify-center p-8"><Loader2 className="animate-spin h-6 w-6 text-green-600" /></div>
                    ) : conversations.length === 0 ? (
                        <div className="p-6 text-center text-gray-500">
                            <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-20" />
                            <p className="text-sm">No conversations yet.</p>
                            <button onClick={() => navigate('member-directory')} className="mt-4 text-green-600 text-sm font-bold hover:underline">
                                Find Members
                            </button>
                        </div>
                    ) : (
                        conversations.map(user => (
                            <div
                                key={user.id}
                                onClick={() => handleUserClick(user)}
                                className={`px-4 py-3 cursor-pointer flex items-center transition-colors border-b border-gray-50 ${
                                    activeChatUser?.id === user.id
                                        ? 'bg-green-50'
                                        : 'hover:bg-gray-50'
                                }`}
                            >
                                <div className="h-12 w-12 bg-gray-100 rounded-full flex items-center justify-center overflow-hidden mr-3 shrink-0">
                                    {user.profileImage ? (
                                        <img src={user.profileImage} alt="" className="h-full w-full object-cover" />
                                    ) : (
                                        <UserIcon className="h-6 w-6 text-gray-400" />
                                    )}
                                </div>
                                <div className="overflow-hidden flex-1 min-w-0">
                                    <h4 className="font-semibold text-[14px] text-gray-900 truncate">{user.businessName}</h4>
                                    <p className="text-xs text-gray-500 truncate">{user.firstName} {user.lastName}</p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* ===== CHAT AREA ===== */}
            <div className={`${!activeChatUser ? 'hidden md:flex' : 'flex'} flex-col flex-1 bg-white md:rounded-r-xl shadow-sm h-full overflow-hidden`}>
                {activeChatUser ? (
                    <>
                        {/* Chat Header */}
                        <div className="px-4 py-3 border-b flex items-center bg-gray-50 shrink-0">
                            <button onClick={() => { setActiveChatUser(null); setMessages([]); }} className="md:hidden mr-3 text-gray-600 hover:text-gray-800 p-1">
                                <ArrowLeft className="h-5 w-5" />
                            </button>
                            <div className="h-10 w-10 bg-gray-100 rounded-full overflow-hidden mr-3 shrink-0">
                                {activeChatUser.profileImage ? (
                                    <img src={activeChatUser.profileImage} alt="" className="h-full w-full object-cover" />
                                ) : (
                                    <UserIcon className="h-5 w-5 text-gray-400 m-2.5" />
                                )}
                            </div>
                            <div className="min-w-0">
                                <h3 className="font-semibold text-gray-800 text-[15px] truncate">{activeChatUser.businessName}</h3>
                                <p className="text-xs text-gray-500 truncate">{activeChatUser.firstName} {activeChatUser.lastName}</p>
                            </div>
                        </div>

                        {/* Messages Area with WhatsApp-style wallpaper */}
                        <div
                            ref={chatContainerRef}
                            onScroll={handleScroll}
                            className="flex-1 overflow-y-auto px-3 sm:px-4 py-2 relative"
                            style={{
                                backgroundColor: '#e5ddd5',
                                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23c9bfb0' fill-opacity='0.15'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                            }}
                        >
                            {isLoadingChat ? (
                                <div className="flex justify-center items-center h-full">
                                    <Loader2 className="animate-spin h-8 w-8 text-gray-400" />
                                </div>
                            ) : messages.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full">
                                    <div className="bg-white bg-opacity-90 rounded-lg px-6 py-4 shadow-sm text-center">
                                        <p className="text-gray-500 text-sm">No messages yet. Say hello!</p>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {/* Top spacer */}
                                    <div className="h-2" />

                                    {messageGroups.map((group, gi) => (
                                        <div key={gi}>
                                            <DateSeparator label={group.label} />
                                            {group.messages.map((msg, mi) => {
                                                const isMe = msg.senderId === currentUser.id;
                                                // Show tail on first message or when sender changes
                                                const prevMsg = mi > 0 ? group.messages[mi - 1] : null;
                                                const showTail = !prevMsg || prevMsg.senderId !== msg.senderId;

                                                return (
                                                    <ChatBubble
                                                        key={msg.id}
                                                        msg={msg}
                                                        isMe={isMe}
                                                        showTail={showTail}
                                                    />
                                                );
                                            })}
                                        </div>
                                    ))}

                                    {/* Bottom spacer */}
                                    <div className="h-2" />
                                </>
                            )}

                            {/* Scroll to bottom FAB */}
                            {showScrollBtn && (
                                <ScrollToBottomButton
                                    onClick={() => scrollToBottom('smooth')}
                                    unreadBelow={newMessagesBelow}
                                />
                            )}
                        </div>

                        {/* Input Area */}
                        <div className="px-3 py-2 bg-gray-50 border-t shrink-0">
                            {error && <p className="text-red-500 text-xs mb-1 px-1">{error}</p>}
                            <form onSubmit={handleSendMessage} className="flex items-end gap-2">
                                <div className="flex-1 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                                    <textarea
                                        ref={textareaRef}
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSendMessage(e);
                                            }
                                        }}
                                        placeholder="Type a message"
                                        rows={1}
                                        className="w-full px-4 py-2.5 text-[14.5px] text-gray-800 placeholder-gray-400 resize-none focus:outline-none leading-[20px]"
                                        style={{
                                            minHeight: '40px',
                                            maxHeight: '112px',
                                            overflow: 'hidden'
                                        }}
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={isSending || !newMessage.trim()}
                                    className="bg-green-500 text-white p-2.5 rounded-full hover:bg-green-600 disabled:opacity-40 disabled:hover:bg-green-500 transition-colors shrink-0 shadow-sm mb-0.5"
                                >
                                    {isSending ? (
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                    ) : (
                                        <Send className="h-5 w-5" />
                                    )}
                                </button>
                            </form>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400" style={{ backgroundColor: '#f0ece5' }}>
                        <div className="text-center">
                            <div className="w-48 h-48 mx-auto mb-6 rounded-full bg-green-50 flex items-center justify-center">
                                <MessageSquare className="h-20 w-20 text-green-200" />
                            </div>
                            <h3 className="text-xl font-light text-gray-600 mb-2">RAN Messaging</h3>
                            <p className="text-sm text-gray-400 max-w-xs mx-auto">Select a conversation to start chatting with other members.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Messages;