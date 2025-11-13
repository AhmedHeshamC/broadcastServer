import Joi from 'joi';
import { IValidationResult } from '../types/types';
import { config } from '../config';

/**
 * Message validation schemas
 */

// Common validation patterns
const linkRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi;
const mentionRegex = /@\w+/g;
const hashtagRegex = /#\w+/g;

// Profanity filter - simple implementation (in production, use a proper filter)
const forbiddenWords = [
  'spam', 'abuse', 'hate', 'violence', 'threat', 'harassment',
  // Add more words as needed
];

/**
 * Validate message content
 */
export const validateMessage = (content: string): IValidationResult => {
  const schema = Joi.object({
    content: Joi.string()
      .required()
      .min(1)
      .max(config.get('maxMessageLength'))
      .messages({
        'string.min': 'Message cannot be empty',
        'string.max': `Message cannot exceed ${config.get('maxMessageLength')} characters`,
        'any.required': 'Message content is required',
      }),
  });

  return validateJoiSchema(schema, { content });
};

/**
 * Validate message content for inappropriate content
 */
export const validateMessageContent = (content: string): IValidationResult => {
  const errors = [];

  // Check for forbidden words
  const lowerContent = content.toLowerCase();
  for (const word of forbiddenWords) {
    if (lowerContent.includes(word)) {
      errors.push({
        field: 'content',
        message: `Message contains inappropriate content`,
      });
      break;
    }
  }

  // Check for excessive links (potential spam)
  const links = content.match(linkRegex);
  if (links && links.length > 3) {
    errors.push({
      field: 'content',
      message: 'Message contains too many links',
    });
  }

  // Check for repetitive characters (potential spam)
  if (/(.)\1{5,}/.test(content)) {
    errors.push({
      field: 'content',
      message: 'Message contains excessive repetitive characters',
    });
  }

  // Check for excessive caps
  const uppercaseRatio = (content.match(/[A-Z]/g) || []).length / content.length;
  if (uppercaseRatio > 0.7 && content.length > 10) {
    errors.push({
      field: 'content',
      message: 'Message contains excessive capitalization',
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Extract message metadata
 */
export const extractMessageMetadata = (content: string) => {
  const metadata = {
    links: content.match(linkRegex) || [],
    mentions: content.match(mentionRegex) || [],
    hashtags: content.match(hashtagRegex) || [],
    wordCount: content.trim().split(/\s+/).length,
    characterCount: content.length,
  };

  return metadata;
};

/**
 * Sanitize message content
 */
export const sanitizeMessage = (content: string): string => {
  return content
    .trim()
    // Remove potentially dangerous HTML tags
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
    // Remove excessive whitespace
    .replace(/\s+/g, ' ')
    // Ensure it's not empty after sanitization
    .trim();
};

/**
 * Validate message for WebSocket transmission
 */
export const validateWebSocketMessage = (data: any): IValidationResult => {
  const schema = Joi.object({
    type: Joi.string()
      .required()
      .valid('message', 'typing', 'stop_typing')
      .messages({
        'any.required': 'Message type is required',
        'any.only': 'Invalid message type',
      }),
    content: Joi.when('type', {
      is: 'message',
      then: Joi.string()
        .required()
        .min(1)
        .max(config.get('maxMessageLength')),
      otherwise: Joi.optional(),
    }),
    roomId: Joi.string().optional().allow(null),
    timestamp: Joi.date().optional(),
  });

  const baseValidation = validateJoiSchema(schema, data);

  if (!baseValidation.isValid) {
    return baseValidation;
  }

  // Additional content validation for messages
  if (data.type === 'message' && data.content) {
    const contentValidation = validateMessageContent(data.content);
    if (!contentValidation.isValid) {
      return contentValidation;
    }
  }

  return { isValid: true, errors: [] };
};

/**
 * Helper function to validate Joi schemas
 */
const validateJoiSchema = (schema: Joi.ObjectSchema, data: any): IValidationResult => {
  const { error, value } = schema.validate(data, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const errors = error.details.map((detail) => ({
      field: detail.path.join('.'),
      message: detail.message,
    }));

    return {
      isValid: false,
      errors,
    };
  }

  return {
    isValid: true,
    errors: [],
  };
};