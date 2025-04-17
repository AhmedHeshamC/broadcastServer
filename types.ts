export interface BroadcastMessage {
  type: 'message';
  payload: string;
  // Add more fields for extensibility (e.g., username, timestamp)
}
