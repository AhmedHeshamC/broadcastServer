/**
 * Factory function to create a new message
 */
export function createMessage(type, payload, sender) {
    return {
        id: generateId(),
        type,
        sender,
        payload,
        timestamp: new Date()
    };
}
/**
 * Generate a unique ID for messages
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}
