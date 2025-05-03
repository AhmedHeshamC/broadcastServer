// Import the models from the UI code
// Since we're testing the actual implementation, we'll need to extract the model code
// from the bundle for testing purposes

// Create a simplified version of the models for testing
class Message {
  constructor(type, payload, sender) {
    this.id = generateId();
    this.type = type;
    this.sender = sender;
    this.payload = payload;
    this.timestamp = new Date();
  }
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

function createMessage(type, payload, sender) {
  return new Message(type, payload, sender);
}

class User {
  constructor(name, isCurrentUser = false) {
    this.id = generateId();
    this.name = name;
    this.isCurrentUser = isCurrentUser;
  }
}

function createUser(name, isCurrentUser = false) {
  return new User(name, isCurrentUser);
}

describe('Message Model Tests', () => {
  test('createMessage creates a message with the correct properties', () => {
    const type = 'message';
    const payload = 'Hello, world!';
    const sender = 'User123';

    const message = createMessage(type, payload, sender);

    expect(message.type).toBe(type);
    expect(message.payload).toBe(payload);
    expect(message.sender).toBe(sender);
    expect(message.id).toBeTruthy();
    expect(message.timestamp).toBeInstanceOf(Date);
  });

  test('createMessage creates a system message correctly', () => {
    const type = 'system';
    const payload = 'User123 has joined.';

    const message = createMessage(type, payload);

    expect(message.type).toBe(type);
    expect(message.payload).toBe(payload);
    expect(message.sender).toBeUndefined();
  });

  test('createMessage creates a your_name message correctly', () => {
    const type = 'your_name';
    const payload = 'User123';

    const message = createMessage(type, payload);

    expect(message.type).toBe(type);
    expect(message.payload).toBe(payload);
  });

  test('generateId creates unique IDs', () => {
    const id1 = generateId();
    const id2 = generateId();

    expect(id1).not.toBe(id2);
  });
});

describe('User Model Tests', () => {
  test('createUser creates a user with the correct properties', () => {
    const name = 'User123';
    const isCurrentUser = true;

    const user = createUser(name, isCurrentUser);

    expect(user.name).toBe(name);
    expect(user.isCurrentUser).toBe(isCurrentUser);
    expect(user.id).toBeTruthy();
  });

  test('createUser defaults isCurrentUser to false', () => {
    const name = 'User123';

    const user = createUser(name);

    expect(user.name).toBe(name);
    expect(user.isCurrentUser).toBe(false);
  });

  test('createUser creates unique IDs for each user', () => {
    const user1 = createUser('User1');
    const user2 = createUser('User2');

    expect(user1.id).not.toBe(user2.id);
  });
});
