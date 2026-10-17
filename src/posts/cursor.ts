export interface CursorPayload {
	v: string;
	id: string;
}

export function encodeCursor(payload: CursorPayload): string {
	return Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
}

export function decodeCursor(token: string): CursorPayload | null {
	try {
		const obj = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
		if (obj && typeof obj.v === 'string' && typeof obj.id === 'string') {
			return { v: obj.v, id: obj.id };
		}
		return null;
	} catch {
		return null;
	}
}
