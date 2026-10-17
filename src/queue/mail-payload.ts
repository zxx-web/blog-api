export type MailKind = 'welcome' | 'notification' | 'repeat';

export interface MailJobData {
	kind: MailKind;
	to: string;
	subject: string;
	body: string;
	idempotencyKey: string;
}
