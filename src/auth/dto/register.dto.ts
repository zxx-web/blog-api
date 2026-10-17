import { IsEmail, IsString, Length, Matches, MaxLength } from 'class-validator';
import { IsStrongPassword } from 'src/common/validators/is-strong-password.validator';

export class RegisterDto {
	@IsEmail({}, { message: 'email 格式不正确' })
	@MaxLength(255)
	email!: string;

	@IsString()
	@Length(3, 50)
	@Matches(/^[a-zA-Z0-9-_]+$/, {
		message: 'username 只能包含字母/数字/下划线/连字符'
	})
	username!: string;

	@IsString()
	@IsStrongPassword()
	password!: string;
}
