import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';
import { IValidationError, IValidationResult, AuthProvider, IApiResponse } from '../types/types';

/**
 * Email validation regex
 */
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Username validation regex - alphanumeric with underscores and hyphens
 */
const usernameRegex = /^[a-zA-Z0-9_-]+$/;

/**
 * Password validation schema
 */
const passwordSchema = Joi.string()
  .min(6)
  .max(128)
  .required()
  .messages({
    'string.min': 'Password must be at least 6 characters long',
    'string.max': 'Password must not exceed 128 characters',
    'any.required': 'Password is required',
  });

/**
 * User registration validation
 */
export const validateRegistration = (data: any): IValidationResult => {
  const schema = Joi.object({
    email: Joi.string()
      .email()
      .pattern(emailRegex)
      .required()
      .messages({
        'string.email': 'Please provide a valid email address',
        'any.required': 'Email is required',
      }),
    username: Joi.string()
      .min(3)
      .max(30)
      .pattern(usernameRegex)
      .required()
      .messages({
        'string.min': 'Username must be at least 3 characters long',
        'string.max': 'Username must not exceed 30 characters',
        'string.pattern.base': 'Username can only contain letters, numbers, underscores, and hyphens',
        'any.required': 'Username is required',
      }),
    password: passwordSchema,
    authProvider: Joi.string()
      .valid(...Object.values(AuthProvider))
      .default(AuthProvider.EMAIL),
    avatar: Joi.string().uri().optional().allow(''),
  });

  return validateJoiSchema(schema, data);
};

/**
 * User login validation
 */
export const validateLogin = (data: any): IValidationResult => {
  const schema = Joi.object({
    email: Joi.string()
      .email()
      .pattern(emailRegex)
      .required()
      .messages({
        'string.email': 'Please provide a valid email address',
        'any.required': 'Email is required',
      }),
    password: Joi.string().required().messages({
      'any.required': 'Password is required',
    }),
  });

  return validateJoiSchema(schema, data);
};

/**
 * Refresh token validation
 */
export const validateRefreshToken = (data: any): IValidationResult => {
  const schema = Joi.object({
    refreshToken: Joi.string().required().messages({
      'any.required': 'Refresh token is required',
      'string.empty': 'Refresh token cannot be empty',
    }),
  });

  return validateJoiSchema(schema, data);
};

/**
 * JWT token validation
 */
export const validateToken = (data: any): IValidationResult => {
  const schema = Joi.object({
    token: Joi.string().required().messages({
      'any.required': 'Token is required',
      'string.empty': 'Token cannot be empty',
    }),
  });

  return validateJoiSchema(schema, data);
};

/**
 * Password update validation
 */
export const validatePasswordUpdate = (data: any): IValidationResult => {
  const schema = Joi.object({
    currentPassword: Joi.string().required().messages({
      'any.required': 'Current password is required',
    }),
    newPassword: passwordSchema.label('New password'),
    confirmPassword: Joi.string()
      .valid(Joi.ref('newPassword'))
      .required()
      .messages({
        'any.only': 'Password confirmation does not match new password',
        'any.required': 'Password confirmation is required',
      }),
  });

  return validateJoiSchema(schema, data);
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
    const errors: IValidationError[] = error.details.map((detail) => ({
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

/**
 * Validation middleware factory
 */
export const validate = (validator: (data: any) => IValidationResult) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const validationResult = validator(req.body);

    if (!validationResult.isValid) {
      const errorMap = validationResult.errors.reduce((acc, error) => {
        const key = error.field;
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(error.message);
        return acc;
      }, {} as Record<string, string[]>);

      const response: IApiResponse = {
        success: false,
        error: 'Validation failed',
        errors: errorMap,
      };

      res.status(400).json(response);
      return;
    }

    // Replace req.body with validated and cleaned data
    req.body = { ...req.body, ...validationResult };
    next();
  };
};