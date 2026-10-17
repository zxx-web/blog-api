export interface SaveInput {
	buffer: Buffer;
	key: string;
	contentType: string;
}

export interface StoredFile {
	key: string;
	url: string;
	size: number;
	contentType: string;
}

export abstract class StorageService {
	abstract readonly backend: 'local' | 's3';

	abstract readonly available: boolean;

	abstract save(input: SaveInput): Promise<StoredFile>;

	abstract delete(key: string): Promise<void>;

	abstract exists(key: string): Promise<boolean>;

	abstract publicUrl(key: string): string;

	abstract keyFromPublicUrl(url: string): string | null;
}
