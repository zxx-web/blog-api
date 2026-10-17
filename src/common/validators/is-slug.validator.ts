import {
	registerDecorator,
	ValidationArguments,
	ValidationOptions,
	ValidatorConstraint,
	ValidatorConstraintInterface
} from 'class-validator';

const SLUG_RE = /^[0-9a-z]+(?:-[0-9a-z]+)*$/;

@ValidatorConstraint({ name: 'IsSlug', async: false })
export class IsSlugConstraint implements ValidatorConstraintInterface {
	validate(value: any): boolean {
		return (
			typeof value === 'string' && value.length < 80 && SLUG_RE.test(value)
		);
	}
	defaultMessage(validationArguments: ValidationArguments): string {
		return `${validationArguments.property} 必须是小写字母、数字和连字符组成的 slug（不能以 - 开头/结尾，最长 80）`;
	}
}

export function IsSlug(options?: ValidationOptions): PropertyDecorator {
	return (object, propertyName) => {
		registerDecorator({
			target: object.constructor,
			propertyName: propertyName as string,
			options,
			constraints: [],
			validator: IsSlugConstraint
		});
	};
}
