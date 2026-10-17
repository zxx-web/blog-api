import {
	registerDecorator,
	ValidationArguments,
	ValidationOptions,
	ValidatorConstraint,
	ValidatorConstraintInterface
} from 'class-validator';

const COMMON_PASSWORDS = new Set([
	'password',
	'password1',
	'password123',
	'passw0rd',
	'12345678',
	'123456789',
	'1234567890',
	'11111111',
	'00000000',
	'qwerty123',
	'qwertyui',
	'abc12345',
	'iloveyou',
	'letmein',
	'letmein1',
	'welcome',
	'welcome1',
	'admin',
	'admin123',
	'administrator',
	'root',
	'toor',
	'superman',
	'dragon',
	'monkey',
	'football',
	'baseball',
	'master',
	'login',
	'princess',
	'sunshine',
	'michael',
	'ninja'
]);

@ValidatorConstraint({ name: 'IsStrongPassword', async: false })
export class IsStrongPasswordConstraint implements ValidatorConstraintInterface {
	validate(value: any): boolean {
		if (typeof value !== 'string') return false;
		if (value.length < 8 || value.length > 100) return false;

		let classes = 0;
		if (/[a-z]/.test(value)) classes++;
		if (/[A-Z]/.test(value)) classes++;
		if (/[0-9]/.test(value)) classes++;
		if (/[^a-zA-Z0-9]/.test(value)) classes++;

		if (classes < 3) return false;

		if (COMMON_PASSWORDS.has(value.trim().toLowerCase())) return false;

		return true;
	}
	defaultMessage(validationArguments: ValidationArguments): string {
		return `${validationArguments.property} 强度不足，需8-100位，含大小写字母/数字/符号最少3种，且不能是常见密码`;
	}
}

export function IsStrongPassword(
	options?: ValidationOptions
): PropertyDecorator {
	return (object, propertyName) => {
		registerDecorator({
			target: object.constructor,
			propertyName: propertyName as string,
			options,
			constraints: [],
			validator: IsStrongPassword
		});
	};
}
