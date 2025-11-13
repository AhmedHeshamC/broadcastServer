import mongoose, { Schema, Document, Types } from 'mongoose';
import { MessageType, IMessage, IMessageBase, IMessageCreateInput } from '../types/types';

export interface IMessageDocument extends IMessageBase, Document {
  softDelete(): Promise<void>;
  markAsEdited(newContent: string): Promise<void>;
  isDeleted(): boolean;
}

const messageSchema = new Schema<IMessageDocument>({
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000, // Configurable max message length
  },
  type: {
    type: String,
    enum: Object.values(MessageType),
    default: MessageType.MESSAGE,
    required: true,
  },
  senderId: {
    type: String,
    required: true,
  },
  senderName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 30,
  },
  roomId: {
    type: String,
    default: null,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  isEdited: {
    type: Boolean,
    default: false,
  },
  editedAt: {
    type: Date,
    default: null,
  },
  deletedAt: {
    type: Date,
    default: null,
  },
  metadata: {
    type: Schema.Types.Mixed,
    default: {},
  },
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      // Don't include deletedAt in JSON output unless explicitly requested
      if (ret.deletedAt) {
        delete ret.deletedAt;
      }
      return ret;
    },
  },
});

// Indexes for efficient queries
messageSchema.index({ senderId: 1, timestamp: -1 });
messageSchema.index({ roomId: 1, timestamp: -1 });
messageSchema.index({ timestamp: -1 });
messageSchema.index({ type: 1, timestamp: -1 });

// Compound index for message pagination
messageSchema.index({ roomId: 1, deletedAt: 1, timestamp: -1 });

// Pre-save middleware to set timestamp if not provided
messageSchema.pre('save', function(next) {
  if (this.isNew && !this.get('timestamp')) {
    this.set('timestamp', new Date());
  }
  next();
});

// Instance method to soft delete a message
messageSchema.methods.softDelete = async function(): Promise<void> {
  this.set('deletedAt', new Date());
  await this.save();
};

// Instance method to edit message content
messageSchema.methods.editContent = async function(newContent: string): Promise<void> {
  this.content = newContent.trim();
  this.isEdited = true;
  this.editedAt = new Date();
  await this.save();
};

// Instance method to mark message as edited
messageSchema.methods.markAsEdited = async function(newContent: string): Promise<void> {
  this.content = newContent.trim();
  this.isEdited = true;
  this.editedAt = new Date();
  await this.save();
};

// Instance method to check if message is deleted
messageSchema.methods.isDeleted = function(): boolean {
  return this.deletedAt !== null && this.deletedAt !== undefined;
};

// Static method to find active messages (not deleted)
messageSchema.statics.findActiveMessages = function(filters: any = {}, limit = 50, skip = 0) {
  return this.find({
    ...filters,
    deletedAt: null,
  })
  .sort({ timestamp: -1 })
  .limit(limit)
  .skip(skip)
  .populate('senderId', 'username avatar');
};

// Static method to create message with validation
messageSchema.statics.createMessage = async function(messageData: IMessageCreateInput) {
  const message = new this({
    content: messageData.content.trim(),
    type: messageData.type || MessageType.MESSAGE,
    senderId: messageData.senderId,
    senderName: messageData.senderName,
    roomId: messageData.roomId || null,
  });

  return message.save();
};

// Static method to get messages for a room or global messages
messageSchema.statics.getRecentMessages = function(roomId: string | null, limit = 50) {
  const filters = roomId ? { roomId } : { roomId: null };

  return this.find({
    ...filters,
    deletedAt: null,
  })
  .sort({ timestamp: -1 })
  .limit(limit)
  .populate('senderId', 'username avatar');
};

// Static method to count messages by user
messageSchema.statics.countUserMessages = function(userId: string) {
  return this.countDocuments({
    senderId: userId,
    deletedAt: null,
  });
};

// Static method to find messages by sender ID
messageSchema.statics.findBySenderId = function(senderId: string) {
  return this.find({
    senderId,
    deletedAt: null,
  }).sort({ timestamp: -1 });
};

// Static method to find messages by type
messageSchema.statics.findByType = function(type: MessageType) {
  return this.find({
    type,
    deletedAt: null,
  }).sort({ timestamp: -1 });
};

// Static method to get paginated messages with filters and sorting
messageSchema.statics.getMessagesPaginated = async function(
  filter: any = {},
  options: { page: number; limit: number; sortBy?: string } = { page: 1, limit: 50 }
) {
  const { page = 1, limit = 50, sortBy = '-createdAt' } = options;
  const skip = (page - 1) * limit;

  // Build sort object
  const sortObj: any = {};
  if (sortBy.startsWith('-')) {
    sortObj[sortBy.substring(1)] = -1;
  } else {
    sortObj[sortBy] = 1;
  }

  // Apply deletedAt filter if not already present
  const finalFilter = {
    ...filter,
    deletedAt: filter.deletedAt || null
  };

  const [messages, totalCount] = await Promise.all([
    this.find(finalFilter)
      .sort(sortObj)
      .skip(skip)
      .limit(limit)
      .populate('senderId', 'username email avatar role'),
    this.countDocuments(finalFilter)
  ]);

  return {
    messages,
    totalCount,
    currentPage: page,
    totalPages: Math.ceil(totalCount / limit),
    hasNextPage: page < Math.ceil(totalCount / limit),
    hasPreviousPage: page > 1
  };
};

// Static method to get recent messages (global)
messageSchema.statics.getRecentGlobalMessages = function(limit: number = 50) {
  return this.find({
    deletedAt: null,
    type: { $in: [MessageType.MESSAGE, MessageType.SYSTEM] }
  })
  .sort({ timestamp: -1 })
  .limit(limit);
};

// Static method to count messages by sender
messageSchema.statics.countBySender = async function() {
  const pipeline = [
    {
      $match: { deletedAt: null }
    },
    {
      $group: {
        _id: '$senderId',
        count: { $sum: 1 }
      }
    }
  ];

  const results = await this.aggregate(pipeline);
  const countMap = new Map<string, number>();

  results.forEach(result => {
    countMap.set(result._id, result.count);
  });

  return countMap;
};

// Static method to find messages after a specific date
messageSchema.statics.findMessagesAfter = function(date: Date) {
  return this.find({
    timestamp: { $gte: date },
    deletedAt: null,
  }).sort({ timestamp: 1 });
};

// Static method to aggregate messages by user
messageSchema.statics.aggregateByUser = async function(filter: any = {}) {
  const finalFilter = {
    ...filter,
    deletedAt: null
  };

  const pipeline = [
    {
      $match: finalFilter
    },
    {
      $group: {
        _id: '$senderId',
        count: { $sum: 1 },
        lastMessage: { $max: '$timestamp' },
        totalCharacters: { $sum: { $strLenCP: '$content' } }
      }
    },
    {
      $sort: { count: -1 as const }
    }
  ];

  return this.aggregate(pipeline);
};

// Static method to aggregate messages by type
messageSchema.statics.aggregateByType = async function(filter: any = {}) {
  const finalFilter = {
    ...filter,
    deletedAt: null
  };

  const pipeline = [
    {
      $match: finalFilter
    },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
        lastMessage: { $max: '$timestamp' }
      }
    },
    {
      $sort: { count: -1 as const }
    }
  ];

  return this.aggregate(pipeline);
};

export interface IMessageModel extends mongoose.Model<IMessageDocument> {
  findActiveMessages(filters?: any, limit?: number, skip?: number): Promise<IMessageDocument[]>;
  createMessage(messageData: IMessageCreateInput): Promise<IMessageDocument>;
  getRecentMessages(roomId: string | null, limit?: number): Promise<IMessageDocument[]>;
  countUserMessages(userId: string): Promise<number>;
  findBySenderId(senderId: string): Promise<IMessageDocument[]>;
  findByType(type: MessageType): Promise<IMessageDocument[]>;
  getMessagesPaginated(filter: any, options: { page: number; limit: number; sortBy?: string }): Promise<{
    messages: IMessageDocument[];
    totalCount: number;
    currentPage: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  }>;
  getRecentGlobalMessages(limit?: number): Promise<IMessageDocument[]>;
  countBySender(): Promise<Map<string, number>>;
  findMessagesAfter(date: Date): Promise<IMessageDocument[]>;
  aggregateByUser(filter?: any): Promise<any[]>;
  aggregateByType(filter?: any): Promise<any[]>;
}

export const Message = mongoose.model<IMessageDocument, IMessageModel>('Message', messageSchema);