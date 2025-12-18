import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { config } from '../config';
import logger from '../utils/logger';

// Reference shared proto repository
// In Docker (dev/prod): proto is at /app/proto
// Locally: proto is at ../../../../proto relative to this file
const isDocker = process.cwd() === '/app';
const PROTO_PATH = isDocker
  ? '/app/proto/user.proto'
  : path.resolve(__dirname, '../../../../proto/user.proto');

// User role enum matching proto
export enum UserRole {
  UNSPECIFIED = 0,
  USER = 1,
  ADMIN = 2,
}

// User status enum matching proto
export enum UserStatus {
  UNSPECIFIED = 0,
  ACTIVE = 1,
  INACTIVE = 2,
  SUSPENDED = 3,
}

export interface User {
  id: string;
  subject: string;
  email: string;
  first_name: string;
  last_name: string;
  display_name: string;
  avatar_url: string;
  role: UserRole;
  status: UserStatus;
  organization_id: string;
  created_at: string;
  updated_at: string;
  metadata: Record<string, string>;
}

interface GetUserResponse {
  user: User;
}

interface UserServiceClient {
  GetUser(
    request: { user_id: string },
    callback: (error: grpc.ServiceError | null, response: GetUserResponse) => void,
  ): void;
}

type ServiceClientConstructor = new (
  address: string,
  credentials: grpc.ChannelCredentials,
) => UserServiceClient;

interface UserProtoNamespace {
  UserService: ServiceClientConstructor;
}

let packageDefinition: protoLoader.PackageDefinition | null = null;
let userProto: UserProtoNamespace | null = null;
let cachedClient: UserServiceClient | null = null;

/**
 * Initialize the gRPC client (lazy loading)
 */
const initializeClient = (): void => {
  if (!packageDefinition) {
    try {
      packageDefinition = protoLoader.loadSync(PROTO_PATH, {
        keepCase: true,
        longs: String,
        enums: Number,
        defaults: true,
        oneofs: true,
      });
      userProto = grpc.loadPackageDefinition(packageDefinition)
        .user as unknown as UserProtoNamespace;
      logger.info('User gRPC proto loaded successfully');
    } catch (error) {
      logger.error('Failed to load user.proto:', error);
      throw error;
    }
  }
};

/**
 * Get or create the gRPC client
 */
export const getUserClient = (
  serverAddress: string = config.grpc.userServiceUrl,
): UserServiceClient => {
  initializeClient();

  if (!cachedClient && userProto) {
    cachedClient = new userProto.UserService(serverAddress, grpc.credentials.createInsecure());
    logger.info(`User gRPC client connected to ${serverAddress}`);
  }

  if (!cachedClient) {
    throw new Error('Failed to create user gRPC client');
  }

  return cachedClient;
};

/**
 * Get user by ID via user-service gRPC
 */
export const getUser = (userId: string): Promise<User> => {
  return new Promise((resolve, reject) => {
    try {
      const client = getUserClient();

      client.GetUser(
        { user_id: userId },
        (error: grpc.ServiceError | null, response: GetUserResponse) => {
          if (error) {
            logger.error('User gRPC GetUser error:', error.message);
            reject(error);
          } else {
            resolve(response.user);
          }
        },
      );
    } catch (error) {
      logger.error('Failed to call user gRPC:', error);
      reject(error);
    }
  });
};

/**
 * Get user email by user ID
 * Returns null if user not found or email not available
 */
export const getUserEmail = async (userId: string): Promise<string | null> => {
  try {
    const user = await getUser(userId);
    return user.email || null;
  } catch (error) {
    logger.warn('Failed to get user email', { userId, error });
    return null;
  }
};

