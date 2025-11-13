import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcrypt';
import { UserRole, AuthProvider, IUser, IUserBase, IUserCreateInput, IJwtPayload } from '../types/types';

export interface IUserDocument extends IUserBase, Document {
  comparePassword(candidatePassword: string): Promise<boolean>;
  toSafeObject(): Partial<IUser>;
  toJwtPayload(): IJwtPayload;
}

const userSchema = new Schema<IUserDocument>({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
    validate: {
      validator: function(email: string) {
        // Basic email validation regex
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      },
      message: 'Please provide a valid email address'
    }
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30,
    index: true,
  },
  password: {
    type: String,
    required: function(this: IUserDocument) {
      return this.authProvider === AuthProvider.EMAIL;
    },
    minlength: 6,
    select: false,
  },
  role: {
    type: String,
    enum: Object.values(UserRole),
    default: UserRole.USER,
    required: true,
  },
  authProvider: {
    type: String,
    enum: Object.values(AuthProvider),
    default: AuthProvider.EMAIL,
    required: true,
  },
  avatar: {
    type: String,
    default: null,
  },
  isActive: {
    type: Boolean,
    default: true,
    required: true,
  },
  lastSeen: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.password;
      return ret;
    },
  },
});

// Index for efficient queries
userSchema.index({ email: 1, authProvider: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ lastSeen: -1 });

// Password hashing middleware
userSchema.pre('save', async function(next) {
  if (!this.isModified('password') || !this.password) {
    return next();
  }

  try {
    const saltRounds = 12;
    this.password = await bcrypt.hash(this.password, saltRounds);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Instance method to compare passwords
userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  if (!this.password) {
    return false;
  }
  return bcrypt.compare(candidatePassword, this.password);
};

// Instance method to return safe user object (without sensitive data)
userSchema.methods.toSafeObject = function(): Partial<IUser> {
  const userObject = this.toObject();
  delete userObject.password;
  return userObject;
};

// Instance method to convert user to JWT payload
userSchema.methods.toJwtPayload = function(): IJwtPayload {
  return {
    userId: this._id.toString(),
    email: this.email,
    role: this.role
  };
};

// Static method to find user by email with optional password
userSchema.statics.findByEmail = function(email: string, includePassword = false) {
  return this.findOne({
    email: email.toLowerCase(),
    isActive: true
  }).select(includePassword ? '+password' : '-password');
};

// Static method to find user by username
userSchema.statics.findByUsername = function(username: string) {
  return this.findOne({
    username: username.trim(),
    isActive: true
  }).select('-password');
};

// Static method to create user with validation
userSchema.statics.createUser = async function(userData: IUserCreateInput) {
  const existingUser = await this.findOne({
    $or: [
      { email: userData.email.toLowerCase() },
      { username: userData.username.trim() }
    ]
  });

  if (existingUser) {
    throw new Error('User with this email or username already exists');
  }

  const user = new this({
    email: userData.email.toLowerCase(),
    username: userData.username.trim(),
    password: userData.password,
    role: userData.role || UserRole.USER,
    authProvider: userData.authProvider,
    avatar: userData.avatar,
  });

  return user.save();
};

export interface IUserModel extends mongoose.Model<IUserDocument> {
  findByEmail(email: string, includePassword?: boolean): Promise<IUserDocument | null>;
  findByUsername(username: string): Promise<IUserDocument | null>;
  createUser(userData: IUserCreateInput): Promise<IUserDocument>;
}

export const User = mongoose.model<IUserDocument, IUserModel>('User', userSchema);