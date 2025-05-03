/**
 * Factory function to create a new user
 */
export function createUser(name, isCurrentUser = false) {
    return {
        id: generateId(),
        name,
        isCurrentUser
    };
}
/**
 * Generate a unique ID for users
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}
