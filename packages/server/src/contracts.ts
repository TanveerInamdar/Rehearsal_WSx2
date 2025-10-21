import { z } from 'zod';

// Enums
export const BugSeveritySchema = z.enum(['low', 'medium', 'high', 'critical']);
export type BugSeverity = z.infer<typeof BugSeveritySchema>;

export const BugStatusSchema = z.enum(['new', 'queued', 'analyzing', 'analyzed', 'error']);
export type BugStatus = z.infer<typeof BugStatusSchema>;

export const ConsoleLogLevelSchema = z.enum(['log', 'warn', 'error']);
export type ConsoleLogLevel = z.infer<typeof ConsoleLogLevelSchema>;

// Complex schemas
export const ViewportSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});
export type Viewport = z.infer<typeof ViewportSchema>;

export const ConsoleLogSchema = z.object({
  level: ConsoleLogLevelSchema,
  message: z.string(),
  timestamp: z.string().datetime(),
});
export type ConsoleLog = z.infer<typeof ConsoleLogSchema>;

export const NetworkErrorSchema = z.object({
  url: z.string().url(),
  status: z.number().int().optional(),
  method: z.string().optional(),
  timestamp: z.string().datetime(),
});
export type NetworkError = z.infer<typeof NetworkErrorSchema>;

// Main payload schemas
export const CreateBugPayloadSchema = z.object({
  title: z.string().min(1).max(200),
  steps: z.string().min(1).max(1000),
  expected: z.string().min(1).max(500),
  actual: z.string().min(1).max(500),
  severity: BugSeveritySchema,
  url: z.string().url(),
  userAgent: z.string().min(1),
  viewport: ViewportSchema,
  consoleLogs: z.array(ConsoleLogSchema).optional(),
  networkErrors: z.array(NetworkErrorSchema).optional(),
  screenshotDataUrl: z.string().optional(),
  projectPublicKey: z.string().min(1),
});
export type CreateBugPayload = z.infer<typeof CreateBugPayloadSchema>;

export const BugRecordSchema = CreateBugPayloadSchema.extend({
  id: z.string().cuid(),
  createdAt: z.string().datetime(),
  status: BugStatusSchema,
  aiAnalysis: z.string().optional(),
  aiPatchDiff: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  aiProvider: z.string().optional(),
});
export type BugRecord = z.infer<typeof BugRecordSchema>;

export const ListBugsQuerySchema = z.object({
  status: BugStatusSchema.optional(),
  severity: BugSeveritySchema.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
export type ListBugsQuery = z.infer<typeof ListBugsQuerySchema>;

// Job-related schemas
export const JobTypeSchema = z.enum(['ANALYZE_BUG']);
export type JobType = z.infer<typeof JobTypeSchema>;

export const JobStatusSchema = z.enum(['queued', 'processing', 'done', 'error']);
export type JobStatus = z.infer<typeof JobStatusSchema>;

export const JobSchema = z.object({
  id: z.string().cuid(),
  type: JobTypeSchema,
  payload: z.record(z.unknown()),
  status: JobStatusSchema,
  error: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Job = z.infer<typeof JobSchema>;

// Project schemas
export const ProjectSchema = z.object({
  id: z.string().cuid(),
  name: z.string().min(1).max(100),
  publicKey: z.string().min(1),
  secretKey: z.string().min(1),
  createdAt: z.string().datetime(),
});
export type Project = z.infer<typeof ProjectSchema>;

// API Response schemas
export const CreateBugResponseSchema = z.object({
  id: z.string().cuid(),
  status: BugStatusSchema,
});
export type CreateBugResponse = z.infer<typeof CreateBugResponseSchema>;

export const ErrorResponseSchema = z.object({
  error: z.string(),
  details: z.string().optional(),
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
