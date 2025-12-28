
import React, { useState } from 'react';
import MessageMenu from '../components/MessageMenu';
import MessageWindow from '../components/MessageWindow';

const Dashboard = ({ user }) => {
  const [selectedMember, setSelectedMember] = useState(null);

  const handleOpenMessageWindow = (memberId) => {
    setSelectedMember(memberId);
  };

  return (
    <div className="dashboard">
      <MessageMenu user={user} />
      {selectedMember && (
        <MessageWindow user={user} receiverId={selectedMember} />
      )}
    </div>
  );
};

export default Dashboard;
    