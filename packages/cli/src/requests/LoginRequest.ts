import { IsEmail, IsOptional, IsString } from 'class-validator';

export class LoginRequestDto {
	@IsEmail()
	@IsOptional()
	emailOrLdapLoginId?: string;

	@IsString()
	@IsOptional()
	password?: string;

	@IsString()
	@IsOptional()
	mfaCode?: string;

	@IsString()
	@IsOptional()
	mfaRecoveryCode?: string;

	@IsString()
	@IsOptional()
	lilToken?: string;
}
