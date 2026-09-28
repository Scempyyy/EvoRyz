export type FriendRequestStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';

export interface Friend {
  id: string;
  name: string;
  username: string;
  avatar: string;
  createdAt?: string;
}

export interface FriendRequest {
  id: string;
  senderId: string;
  receiverId: string;
  status: FriendRequestStatus;
  createdAt: string;
  updatedAt: string;
  sender?: Friend;
  receiver?: Friend;
}

export interface FriendPing {
  id: string;
  senderId: string;
  receiverId: string;
  createdAt: string;
  senderName?: string;
}
