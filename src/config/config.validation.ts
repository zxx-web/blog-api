import { z } from 'zod';

export const envSchema = z.object({
	NODE_ENV: z
		.enum(['development', 'production', 'test'])
		.default('development'),
	PORT: z.coerce.number().int().min(1).max(65535).default(3000),
	CORS_ORIGIN: z.string().default('http://localhost:5173'),
	PAGE_LIMIT: z.coerce.number().int().min(1).max(100).default(20),
	DATABASE_URL: z
		.string()
		.min(1)
		.refine((v) => v.startsWith('postgres'), {
			message: 'DATABASE_URL 必须是 postgresql:// 连接串'
		}),
	JWT_ACCESS_SECRET: z
		.string()
		.min(
			32,
			'JWT_ACCESS_SECRET 至少 32 个字符（HS256 建议 ≥256-bit，如 openssl rand -base64 32）'
		),
	JWT_ACCESS_TTL: z.coerce.number().int().min(60).default(900),
	REFRESH_TTL_DAYS: z.coerce.number().int().min(1).default(7),
	GITHUB_CLIENT_ID: z.string().optional(),
	GITHUB_CLIENT_SECRET: z.string().optional(),
	GITHUB_CALLBACK_URL: z
		.string()
		.default('http://localhost:3000/auth/github/callback'),
	RATE_LIMIT_TTL: z.coerce.number().int().min(1).default(60),
	RATE_LIMIT_LIMIT: z.coerce.number().int().min(1).default(1000),
	REDIS_URL: z
		.string()
		.min(1)
		.refine((v) => v.startsWith('redis://') || v.startsWith('rediss://'), {
			message: 'REDIS_URL 必须是 redis:// 或 rediss:// 连接串'
		})
		.default('redis://localhost:6379'),
	POST_CACHE_TTL: z.coerce.number().int().min(1).default(300),
	LIST_CACHE_TTL: z.coerce.number().int().min(1).default(60),
	CACHE_TTL_JITTER: z.coerce.number().int().min(0).default(60), // 雪崩：TTL 随机抖动上限（秒）
	NEGATIVE_CACHE_TTL: z.coerce.number().int().min(1).default(30), // 穿透：负缓存存在秒数
	LOCK_TTL: z.coerce.number().int().min(1).default(3), // 击穿：分布式锁存活秒数（>=最慢一次重建）
	MAIL_ATTEMPTS: z.coerce.number().int().min(1).default(3),
	MAIL_BACKOFF_MS: z.coerce.number().int().min(0).default(1000),
	MAIL_CONCURRENCY: z.coerce.number().int().min(1).default(4),
	MAIL_SENT_TTL: z.coerce.number().int().min(1).default(86400),
	SMTP_USER: z.string().optional(),
	SMTP_PASS: z.string().optional(),
	STORAGE_BACKEND: z.enum(['local', 's3']).default('local'),
	STORAGE_LOCAL_DIR: z.string().min(1).default('uploads'),
	STORAGE_PUBLIC_PREFIX: z.string().default('/uploads'),
	UPLOAD_MAX_BYTES: z.coerce
		.number()
		.int()
		.min(1)
		.default(5 * 1024 * 1024),
	COVER_MAX_WIDTH: z.coerce.number().int().min(1).default(1600),
	COVER_FORMAT: z.enum(['webp', 'jpeg', 'png']).default('webp'),

	S3_ENDPOINT: z.string().optional(),
	S3_REGION: z.string().default('auto'),
	S3_BUCKET: z.string().optional(),
	S3_ACCESS_KEY_ID: z.string().optional(),
	S3_SECRET_ACCESS_KEY: z.string().optional(),
	S3_FORCE_PATH_STYLE: z.coerce.boolean().default(false),
	S3_PUBLIC_BASE_URL: z.string().optional(),
	LOGIN_MAX_ATTEMPTS: z.coerce.number().min(1).default(5),
	LOGIN_LOCK_MINUTES: z.coerce.number().min(1).default(15),
	HTTP_BODY_LIMIT_KB: z.coerce.number().min(1).default(100)
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
	const result = envSchema.safeParse(raw);
	if (!result.success) {
		const issues = result.error.issues
			.map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
			.join('\n');
		throw new Error(`环境变量校验失败：\n${issues}`);
	}
	return result.data;
}
