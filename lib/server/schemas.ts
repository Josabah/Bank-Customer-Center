import { z } from 'zod';

export const callSessionSchema = z.object({
  callSessionId: z.string().uuid(),
});

export const identifySchema = z.object({
  callSessionId: z.string().uuid(),
  transcript: z.string().min(1),
  language: z.enum(['en', 'am']).optional(),
});

export const verifyPinSchema = z.object({
  callSessionId: z.string().uuid(),
  customerId: z.string().uuid(),
  pin: z.string().min(1),
  language: z.enum(['en', 'am']).optional(),
});

export const messageSchema = z.object({
  callSessionId: z.string().uuid(),
  speaker: z.enum(['user', 'agent']),
  message: z.string().min(1),
});

export const knowledgeBaseSearchSchema = z.object({
  query: z.string().min(1),
});
