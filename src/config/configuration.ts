import { Env } from './config.validation';

export function configuration(env: Env) {
	return {
		env: env.NODE_ENV,
		port: env.PORT,
		cors: {
			origin: env.CORS_ORIGIN.split(',')
				.map((s) => s.trim())
				.filter(Boolean)
		},
		pagination: {
			defaultLimit: env.PAGE_LIMIT,
			maxLimit: 100
		},
		database: {
			url: env.DATABASE_URL
		},
		auth: {
			accessSecret: env.JWT_ACCESS_SECRET,
			accessTtl: env.JWT_ACCESS_TTL,
			refreshTtlDays: env.REFRESH_TTL_DAYS,
			lockout: {
				maxAttempts: env.LOGIN_MAX_ATTEMPTS,
				windowSec: env.LOGIN_LOCK_MINUTES * 60
			}
		},
		oauth: {
			github: {
				clientId: env.GITHUB_CLIENT_ID,
				clientSecret: env.GITHUB_CLIENT_SECRET,
				callbackUrl: env.GITHUB_CALLBACK_URL
			}
		},
		rateLimit: {
			ttlMs: env.RATE_LIMIT_TTL * 1000,
			limit: env.RATE_LIMIT_LIMIT
		},
		redis: {
			url: env.REDIS_URL,
			postTtlSec: env.POST_CACHE_TTL,
			listTtlSec: env.LIST_CACHE_TTL,
			ttlJitterSec: env.CACHE_TTL_JITTER,
			negativeTtlSec: env.NEGATIVE_CACHE_TTL,
			lockTtlSec: env.LOCK_TTL
		},
		queue: {
			attempts: env.MAIL_ATTEMPTS,
			backoffMs: env.MAIL_BACKOFF_MS,
			concurrency: env.MAIL_CONCURRENCY,
			sentTtlSec: env.MAIL_SENT_TTL
		},
		smtp: {
			user: env.SMTP_USER,
			pass: env.SMTP_PASS
		},
		storage: {
			backend: env.STORAGE_BACKEND,
			localDir: env.STORAGE_LOCAL_DIR,
			localPublicPrefix: env.STORAGE_PUBLIC_PREFIX,
			upload: {
				maxBytes: env.UPLOAD_MAX_BYTES
			},
			cover: {
				maxWidth: env.COVER_MAX_WIDTH,
				format: env.COVER_FORMAT
			},
			s3: {
				endpoint: env.S3_ENDPOINT,
				region: env.S3_REGION,
				bucket: env.S3_BUCKET,
				accessKeyId: env.S3_ACCESS_KEY_ID,
				secretAccessKey: env.S3_SECRET_ACCESS_KEY,
				forcePathStyle: env.S3_FORCE_PATH_STYLE,
				publicBaseUrl: env.S3_PUBLIC_BASE_URL
			}
		},
		http: {
			bodyLimitKb: env.HTTP_BODY_LIMIT_KB
		}
	};
}

export type AppConfig = ReturnType<typeof configuration>;
