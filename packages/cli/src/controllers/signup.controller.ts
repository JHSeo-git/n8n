import { Body, Post, RestController } from '@n8n/decorators';
import { Response } from 'express';
import { Logger } from 'n8n-core';
import { Container } from '@n8n/di';

import { AuthService } from '@/auth/auth.service';
import { UserRepository } from '@/databases/repositories/user.repository';
import { AuthError } from '@/errors/response-errors/auth.error';
import { BadRequestError } from '@/errors/response-errors/bad-request.error';
import { UserService } from '@/services/user.service';
import { AuthenticatedRequest, AuthlessRequest } from '@/requests';
import type { PublicUser } from '@/interfaces';

@RestController()
export class SignupController {
	constructor(
		private readonly logger: Logger,
		private readonly authService: AuthService,
		private readonly userService: UserService,
		private readonly userRepository: UserRepository,
	) {}

	@Post('/signup', { skipAuth: true })
	async signup(
		req: AuthlessRequest,
		res: Response,
		@Body payload: {
			email: string;
			password?: string;
			firstName: string;
			lastName: string;
			lilToken?: string;
		},
	): Promise<PublicUser> {
		const { email, password, firstName, lastName, lilToken } = payload;

		// 이메일로 사용자 검색
		const existingUser = await this.userRepository.findOne({ where: { email } });
		if (existingUser) {
			throw new BadRequestError('User with this email already exists');
		}

		// LIL 토큰이 있는 경우
		if (lilToken) {
			try {
				const decoded = jwt.verify(
					lilToken,
					process.env.N8N_USER_MANAGEMENT_JWT_SECRET || '',
				) as jwt.JwtPayload;

				if (decoded.iss === 'lil.lgcns.com' && decoded.email === email) {
					// LIL 토큰이 유효한 경우 사용자 생성
					const user = await this.userService.create({
						email,
						firstName,
						lastName,
						password: password || Math.random().toString(36).slice(-8), // 임시 비밀번호 생성
						role: 'global:member',
					});

					this.authService.issueCookie(res, user, req.browserId);
					return await this.userService.toPublic(user);
				}
			} catch (error) {
				this.logger.error('LIL token verification failed:', { error });
				throw new AuthError('Invalid LIL token');
			}
		}

		// 일반 회원가입 처리
		if (!password) {
			throw new BadRequestError('Password is required');
		}

		const user = await this.userService.create({
			email,
			firstName,
			lastName,
			password,
			role: 'global:member',
		});

		this.authService.issueCookie(res, user, req.browserId);
		return await this.userService.toPublic(user);
	}
}
