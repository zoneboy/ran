
export interface Message {
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: Date;
}

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  profileImage?: string;
  status: string;
}
    