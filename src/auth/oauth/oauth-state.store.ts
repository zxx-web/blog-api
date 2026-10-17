import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';

@Injectable()
export class OauthStateStore {
	private readonly store = new Map<string, number>();
	private readonly ttlMs = 10 * 60 * 1000;

	generate() {
		const state = randomBytes(16).toString('hex');
		this.store.set(state, Date.now() + this.ttlMs);
		this.sweep();
		return state;
	}

	consume(state: string): boolean {
		const expiresAt = this.store.get(state);
		if (expiresAt === undefined) return false;
		this.store.delete(state);
		return expiresAt > Date.now();
	}

	private sweep() {
		const now = Date.now();
		for (const [s, exp] of this.store) {
			if (exp <= now) {
				this.store.delete(s);
			}
		}
	}
}
