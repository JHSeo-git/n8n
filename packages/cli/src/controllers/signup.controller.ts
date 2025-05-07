import { Body, Post, RestController } from '@n8n/decorators';
import { Response } from 'express';
import { Logger } from 'n8n-core';
import { Container } from '@n8n/di';
import jwt from 'jsonwebtoken';

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
				this.logger.debug('Processing LIL token signup attempt', { email });

				const decoded = jwt.verify(lilToken, process.env.N8N_USER_MANAGEMENT_JWT_SECRET || '');
				if (typeof decoded === 'string') {
					throw new AuthError('Invalid LIL token payload');
				}

				if (decoded.iss === 'lil.lgcns.com' && decoded.email === email) {
					// LIL 토큰이 유효한 경우 사용자 생성
					const newUser = this.userRepository.create({
						email,
						firstName,
						lastName,
						password: password || Math.random().toString(36).slice(-8), // 임시 비밀번호 생성
						role: 'global:member',
					});

					this.logger.debug('Creating new user from LIL token', { email });
					const user = await this.userRepository.save(newUser);

					this.authService.issueCookie(res, user, req.browserId);
					return await this.userService.toPublic(user);
				}
			} catch (error) {
				this.logger.error('LIL token verification failed during signup:', { error });
				throw new AuthError('Invalid LIL token');
			}
		}

		// 일반 회원가입 처리
		if (!password) {
			throw new BadRequestError('Password is required for regular signup');
		}

		const newUser = this.userRepository.create({
			email,
			firstName,
			lastName,
			password,
			role: 'global:member',
		});

		const user = await this.userRepository.save(newUser);

		this.authService.issueCookie(res, user, req.browserId);
		return await this.userService.toPublic(user);
	}
}
