import mongoose, { Schema, Document } from 'mongoose';
import { AuditEventType, IAuditLog, IAuditLogBase } from '../types/types';

export interface IAuditLogDocument extends IAuditLogBase, Document {
  createdAt: Date;
  updatedAt: Date;
}

const auditLogSchema = new Schema<IAuditLogDocument>({
  userId: {
    type: String,
    default: null,
    index: true,
  },
  eventType: {
    type: String,
    enum: Object.values(AuditEventType),
    required: true,
    index: true,
  },
  details: {
    type: Schema.Types.Mixed,
    default: {},
  },
  ipAddress: {
    type: String,
    required: true,
    index: true,
  },
  userAgent: {
    type: String,
    default: null,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  success: {
    type: Boolean,
    required: true,
    default: true,
    index: true,
  },
}, {
  timestamps: true,
});

// Indexes for efficient queries
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ eventType: 1, timestamp: -1 });
auditLogSchema.index({ ipAddress: 1, timestamp: -1 });
auditLogSchema.index({ success: 1, timestamp: -1 });

// Compound index for security analytics
auditLogSchema.index({ eventType: 1, success: 1, timestamp: -1 });

// TTL index to automatically remove old logs (90 days)
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

// Static method to create audit log entry
auditLogSchema.statics.createLog = async function(
  eventType: AuditEventType,
  ipAddress: string,
  userId?: string,
  details: Record<string, any> = {},
  success = true,
  userAgent?: string
) {
  const log = new this({
    userId,
    eventType,
    details,
    ipAddress,
    userAgent,
    success,
  });

  return log.save();
};

// Static method to find failed login attempts for IP
auditLogSchema.statics.findFailedLoginsByIP = function(ipAddress: string, timeWindowMinutes = 15) {
  const timeWindow = new Date(Date.now() - timeWindowMinutes * 60 * 1000);

  return this.find({
    ipAddress,
    eventType: AuditEventType.LOGIN_FAILED,
    timestamp: { $gte: timeWindow },
  });
};

// Static method to count failed login attempts for IP
auditLogSchema.statics.countFailedLoginsByIP = async function(ipAddress: string, timeWindowMinutes = 15) {
  const timeWindow = new Date(Date.now() - timeWindowMinutes * 60 * 1000);

  const count = await this.find({
    ipAddress,
    eventType: AuditEventType.LOGIN_FAILED,
    timestamp: { $gte: timeWindow },
  }).countDocuments();

  return count;
};

// Static method to get user activity
auditLogSchema.statics.getUserActivity = function(userId: string, limit = 50) {
  return this.find({ userId })
    .sort({ timestamp: -1 })
    .limit(limit);
};

// Static method to get security events
auditLogSchema.statics.getSecurityEvents = function(limit = 100) {
  return this.find({
    eventType: {
      $in: [
        AuditEventType.LOGIN_FAILED,
        AuditEventType.USER_BANNED,
        AuditEventType.ADMIN_ACTION,
      ],
    },
  })
  .sort({ timestamp: -1 })
  .limit(limit)
  .populate('userId', 'username email');
};

// Static method to get analytics for dashboard
auditLogSchema.statics.getAnalytics = function(startDate?: Date, endDate?: Date) {
  const matchStage: any = {};
  if (startDate || endDate) {
    matchStage.timestamp = {};
    if (startDate) matchStage.timestamp.$gte = startDate;
    if (endDate) matchStage.timestamp.$lte = endDate;
  }

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$eventType',
        count: { $sum: 1 },
        successCount: {
          $sum: { $cond: ['$success', 1, 0] }
        },
        failCount: {
          $sum: { $cond: ['$success', 0, 1] }
        },
      },
    },
    {
      $group: {
        _id: null,
        totalEvents: { $sum: '$count' },
        events: {
          $push: {
            type: '$_id',
            count: '$count',
            successCount: '$successCount',
            failCount: '$failCount',
          },
        },
      },
    },
  ]);
};

export interface IAuditLogModel extends mongoose.Model<IAuditLogDocument> {
  createLog(
    eventType: AuditEventType,
    ipAddress: string,
    userId?: string,
    details?: Record<string, any>,
    success?: boolean,
    userAgent?: string
  ): Promise<IAuditLogDocument>;
  findFailedLoginsByIP(ipAddress: string, timeWindowMinutes?: number): Promise<IAuditLogDocument[]>;
  countFailedLoginsByIP(ipAddress: string, timeWindowMinutes?: number): Promise<number>;
  getUserActivity(userId: string, limit?: number): Promise<IAuditLogDocument[]>;
  getSecurityEvents(limit?: number): Promise<IAuditLogDocument[]>;
  getAnalytics(startDate?: Date, endDate?: Date): Promise<any[]>;
}

export const AuditLog = mongoose.model<IAuditLogDocument, IAuditLogModel>('AuditLog', auditLogSchema);