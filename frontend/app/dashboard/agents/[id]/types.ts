export type Document = { id: string; filename: string; status: string; created_at: string };
export type Lead = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  interest: string | null;
  created_at: string;
};
export type Conversation = { id: string; visitor_id: string | null; created_at: string };
export type Message = { id: string; role: string; content: string; created_at: string };
export type Analytics = {
  conversation_count: number;
  message_count: number;
  lead_count: number;
  document_count: number;
};
export type ChatMessage = { role: "user" | "assistant"; text: string };
export type Agent = {
  id: string;
  business_id: string;
  name: string;
  personality: string | null;
  instructions: string | null;
  created_at: string;
};

export const TABS = ["Test chat", "Settings", "Documents", "Leads", "Conversations", "Analytics"] as const;
export type Tab = (typeof TABS)[number];
