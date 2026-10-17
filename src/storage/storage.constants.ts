export const STORAGE_SERVICE = Symbol('STORAGE_SERVICE');

export const ALLOWED_IMAGE_MIME = new Set([
	'image/jpeg',
	'image/jpg',
	'image/png',
	'image/webp',
	'image/gif',
	'image/avif'
]);

export const MIME_TO_EXT: Record<string, string> = {
	'image/jpeg': 'jpg',
	'image/jpg': 'jpg',
	'image/png': 'png',
	'image/webp': 'webp',
	'image/gif': 'gif',
	'image/avif': 'avif'
};
