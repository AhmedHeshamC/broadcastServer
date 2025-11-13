// MongoDB initialization script for Broadcast Chat
// This script runs when MongoDB container starts for the first time

// Switch to the broadcast chat database
db = db.getSiblingDB('broadcast-chat');

// Create collections with validation schemas
db.createCollection('users', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['username', 'email', 'password', 'role', 'isActive'],
      properties: {
        username: {
          bsonType: 'string',
          minLength: 3,
          maxLength: 30,
          pattern: '^[a-zA-Z0-9_]+$',
          description: 'Username must be 3-30 characters and contain only letters, numbers, and underscores'
        },
        email: {
          bsonType: 'string',
          pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
          description: 'Email must be a valid email address'
        },
        password: {
          bsonType: 'string',
          minLength: 6,
          description: 'Password must be at least 6 characters long'
        },
        role: {
          bsonType: 'string',
          enum: ['user', 'admin'],
          description: 'Role must be either user or admin'
        },
        isActive: {
          bsonType: 'bool',
          description: 'isActive must be a boolean'
        },
        createdAt: {
          bsonType: 'date',
          description: 'createdAt must be a date'
        },
        updatedAt: {
          bsonType: 'date',
          description: 'updatedAt must be a date'
        },
        lastLogin: {
          bsonType: 'date',
          description: 'lastLogin must be a date'
        },
        oauthProvider: {
          bsonType: 'string',
          enum: ['google', 'github'],
          description: 'OAuth provider must be google or github'
        },
        oauthId: {
          bsonType: 'string',
          description: 'OAuth ID must be a string'
        }
      }
    }
  }
});

db.createCollection('auditlogs', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['userId', 'username', 'eventType', 'ipAddress', 'success', 'timestamp'],
      properties: {
        userId: {
          bsonType: 'objectId',
          description: 'User ID must be a valid ObjectId'
        },
        username: {
          bsonType: 'string',
          minLength: 1,
          description: 'Username must be a non-empty string'
        },
        eventType: {
          bsonType: 'string',
          enum: [
            'login_success', 'login_failed', 'logout', 'register',
            'password_change', 'message_sent', 'message_deleted',
            'user_banned', 'user_unbanned', 'role_changed',
            'websocket_connected', 'websocket_disconnected'
          ],
          description: 'Event type must be one of the allowed values'
        },
        ipAddress: {
          bsonType: 'string',
          pattern: '^[0-9.]+$',
          description: 'IP address must be a valid IPv4 address'
        },
        userAgent: {
          bsonType: 'string',
          description: 'User agent must be a string'
        },
        details: {
          bsonType: 'object',
          description: 'Details must be an object'
        },
        success: {
          bsonType: 'bool',
          description: 'Success must be a boolean'
        },
        timestamp: {
          bsonType: 'date',
          description: 'Timestamp must be a date'
        }
      }
    }
  }
});

// Create indexes for performance
db.users.createIndex({ "username": 1 }, { unique: true });
db.users.createIndex({ "email": 1 }, { unique: true });
db.users.createIndex({ "isActive": 1 });
db.users.createIndex({ "createdAt": 1 });

db.auditlogs.createIndex({ "userId": 1 });
db.auditlogs.createIndex({ "eventType": 1 });
db.auditlogs.createIndex({ "timestamp": -1 });
db.auditlogs.createIndex({ "ipAddress": 1 });
db.auditlogs.createIndex({ "success": 1 });

// Create a default admin user (password will be hashed by the application)
print('Creating default admin user...');
db.users.insertOne({
  username: 'admin',
  email: 'admin@broadcast-chat.local',
  password: '$2b$10$placeholder.hash.will.be.replaced.by.application', // Placeholder - app will overwrite
  role: 'admin',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastLogin: null
});

// Create application database user with limited privileges
print('Creating application database user...');
db.createUser({
  user: 'broadcast-app',
  pwd: 'secure-app-password-change-in-production',
  roles: [
    {
      role: 'readWrite',
      db: 'broadcast-chat'
    }
  ]
});

print('MongoDB initialization completed successfully!');
print('');
print('Database: broadcast-chat');
print('Collections: users, auditlogs');
print('Indexes created for performance');
print('Default admin user created (change password after first login)');
print('Application user created with readWrite permissions');
print('');
print('IMPORTANT: Change all default passwords in production!');