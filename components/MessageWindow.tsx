
import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

const MessageWindow = ({ user, receiverId }) => {
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const { data } = await api.get(`/messages/${user.id}/${receiverId}`);
        setMessages(data);
      } catch (error) {
        console.error('Error fetching messages', error);
      }
    };

    fetchMessages();
  }, [user.id, receiverId]);

  const handleSendMessage = async () => {
    if (message.trim()) {
      try {
        const { data } = await api.post('/messages', {
          senderId: user.id,
          receiverId,
          content: message
        });
        setMessages([...messages, data]);
        setMessage('');
      } catch (error) {
        console.error('Error sending message', error);
      }
    }
  };

  return (
    <div className="message-window">
      <div className="messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message ${msg.senderId === user.id ? 'sent' : 'received'}`}>
            <p>{msg.content}</p>
          </div>
        ))}
      </div>
      <div className="message-input">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type a message..."
        />
        <button onClick={handleSendMessage}>Send</button>
      </div>
    </div>
  );
};

export default MessageWindow;
    