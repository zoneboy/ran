
import React, { useEffect, useState } from 'react';
import { api } from '../services/api';

const MessageMenu = ({ user }) => {
  const [conversations, setConversations] = useState([]);

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const { data } = await api.get(`/messages/conversations/${user.id}`);
        setConversations(data);
      } catch (error) {
        console.error('Error fetching conversations', error);
      }
    };
    fetchConversations();
  }, [user.id]);

  return (
    <div className="message-menu">
      <h2>Conversations</h2>
      <ul>
        {conversations.map((convo) => (
          <li key={convo._id}>
            <button onClick={() => console.log(`Open conversation with ${convo.userDetails[0].firstName}`)}>
              {convo.userDetails[0].firstName}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default MessageMenu;
    