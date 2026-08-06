export type Audience = "everyone" | "followers";

export interface InteractionSettings {
  allowMessages: boolean;
  allowAudioCalls: boolean;
  allowVideoCalls: boolean;
  messageAudience: Audience;
  audioCallAudience: Audience;
  videoCallAudience: Audience;
}

export type RelationshipState =
  | "self"
  | "none"
  | "requested"
  | "incoming"
  | "following";

export interface Relationship {
  outgoing: RelationshipState;
  followsYou: boolean;
  canViewPosts: boolean;
  canMessage: boolean;
  canAudioCall: boolean;
  canVideoCall: boolean;
  canInteract: boolean;
}

export interface PublicUser {
  _id: string;
  username: string;
  full_name: string;
  userprofile_image: string;
  bio: string;
  isPrivate: boolean;
}

export interface UserSummary extends PublicUser {
  relationship: Relationship;
}

export interface CurrentUser extends PublicUser {
  email: string;
  additional_name: string;
  pronounce: string;
  link: string;
  link_alias: string;
  location: string;
  language: string;
  isVerfied: boolean;
  isAdmin: boolean;
  interaction: InteractionSettings;
  followersCount: number;
  followingCount: number;
  pendingFollowRequests: number;
  createdAt: string;
  updatedAt: string;
}

export interface Profile extends PublicUser {
  followersCount: number;
  followingCount: number;
  location: string;
  link: string;
  link_alias: string;
  pronounce: string;
  additional_name: string;
  createdAt: string;
  relationship: Relationship;
}

export interface Post {
  _id: string;
  title: string;
  content: string;
  tags: string[];
  isSoftDelete: boolean;
  author: PublicUser;
  likeCount: number;
  likedByMe: boolean;
  commentCount: number;
  shareCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  _id: string;
  post: string;
  parent: string | null;
  text: string;
  isDeleted: boolean;
  author: PublicUser;
  likeCount: number;
  likedByMe: boolean;
  replyCount: number;
  isMine: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FollowRequest {
  requestId: string;
  createdAt: string;
  user: PublicUser;
}

export interface ChatSummary {
  _id: string;
  user: PublicUser | null;
  lastMessage: string;
  lastMessageAt: string | null;
  lastMessageSender: string | null;
  unreadCount: number;
  online: boolean;
  updatedAt: string;
}

export interface ChatMessage {
  _id: string;
  chat: string;
  sender: string;
  receiver: string;
  text: string;
  readAt: string | null;
  createdAt: string;
  /** Present only on the optimistic echo of a message you just sent. */
  tempId?: string | null;
  pending?: boolean;
  failed?: boolean;
}

export type CallKind = "audio" | "video";

export type CallStatus =
  | "idle"
  | "ringing" // outgoing, waiting for them to pick up
  | "incoming" // their call is ringing on your device
  | "connecting"
  | "active"
  | "ended";

export type CallQuality = "good" | "fair" | "poor";

export interface CallLogEntry {
  _id: string;
  callId: string;
  kind: CallKind;
  outcome: "answered" | "declined" | "missed" | "cancelled" | "failed";
  direction: "incoming" | "outgoing";
  peer: PublicUser;
  startedAt: string;
  durationSec: number;
}
