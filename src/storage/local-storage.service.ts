import { Injectable, Logger } from '@nestjs/common';
import { SaveInput, StorageService, StoredFile } from './storage.service';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from 'src/config/configuration';
import { dirname, join, resolve } from 'node:path';
import { promises as fs } from 'node:fs';

@Injectable()
export class LocalStorageService implements StorageService {
	private readonly logger = new Logger(LocalStorageService.name);
	readonly backend = 'local' as const;
	readonly available = true;

	private readonly root: string;
	private readonly publicPrefix: string;

	constructor(config: ConfigService<AppConfig, true>) {
		this.root = resolve(
			process.cwd(),
			config.get('storage.localDir', { infer: true })
		);
		this.publicPrefix = config.get('storage.localPublicPrefix', {
			infer: true
		});
	}

	async save(input: SaveInput): Promise<StoredFile> {
		const abs = join(this.root, input.key);
		await fs.mkdir(dirname(abs), { recursive: true });
		await fs.writeFile(abs, input.buffer);
		return {
			key: input.key,
			url: this.publicUrl(input.key),
			size: input.buffer.length,
			contentType: input.contentType
		};
	}

	async delete(key: string): Promise<void> {
		const abs = this.safeAbs(key);
		if (!abs) return;
		await fs.rm(abs, { force: true });
	}

	async exists(key: string): Promise<boolean> {
		const abs = this.safeAbs(key);
		if (!abs) return false;
		try {
			await fs.access(abs);
			return true;
		} catch {
			return false;
		}
	}

	publicUrl(key: string): string {
		return `${this.publicPrefix}/${key}`;
	}

	keyFromPublicUrl(url: string): string | null {
		const prefix = `${this.publicPrefix}/`;
		return url.startsWith(prefix)
			? decodeURIComponent(url.slice(prefix.length))
			: null;
	}

	private safeAbs(key: string): string | null {
		const abs = resolve(this.root, key);
		if (abs === this.root || abs.startsWith(this.root + '/')) return abs;
		this.logger.warn(`拒绝访问 root 外的路径：${key}`);
		return null;
	}
}
