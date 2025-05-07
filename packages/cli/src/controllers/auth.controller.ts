import { LoginRequestDto, ResolveSignupTokenQueryDto } from '@n8n/api-types';
import { Body, Get, Post, Query, RestController } from '@n8n/decorators';
import { isEmail } from 'class-validator';
import { Response } from 'express';
import { Logger } from 'n8n-core';
import jwt from 'jsonwebtoken';

import { handleEmailLogin, handleLdapLogin } from '@/auth';
import { AuthService } from '@/auth/auth.service';
import { RESPONSE_ERROR_MESSAGES } from '@/constants';
import type { User } from '@/databases/entities/user';
import { UserRepository } from '@/databases/repositories/user.repository';
import { AuthError } from '@/errors/response-errors/auth.error';
import { BadRequestError } from '@/errors/response-errors/bad-request.error';
import { ForbiddenError } from '@/errors/response-errors/forbidden.error';
import { EventService } from '@/events/event.service';
import type { PublicUser } from '@/interfaces';
import { License } from '@/license';
import { MfaService } from '@/mfa/mfa.service';
import { PostHogClient } from '@/posthog';
import { AuthenticatedRequest, AuthlessRequest } from '@/requests';
import { UserService } from '@/services/user.service';
import {
	getCurrentAuthenticationMethod,
	isLdapCurrentAuthenticationMethod,
	isSamlCurrentAuthenticationMethod,
} from '@/sso.ee/sso-helpers';

@RestController()
export class AuthController {
	constructor(
		private readonly logger: Logger,
		private readonly authService: AuthService,
		private readonly mfaService: MfaService,
		private readonly userService: UserService,
		private readonly license: License,
		private readonly userRepository: UserRepository,
		private readonly eventService: EventService,
		private readonly postHog?: PostHogClient,
	) {}

	/** Log in a user */
	@Post('/login', { skipAuth: true, rateLimit: true })
	async login(
		req: AuthlessRequest,
		res: Response,
		@Body payload: LoginRequestDto,
	): Promise<PublicUser | undefined> {
		const { lilToken } = payload;

		console.log('Received /login request:');

		// LIL 토큰이 있는 경우
		if (lilToken) {
			try {
				console.log('LIL token received:', lilToken);
				// if (typeof lilToken !== 'string') {
				// 	throw new AuthError('LIL token is required');
				// }
				// const decoded = jwt.verify(lilToken, process.env.N8N_USER_MANAGEMENT_JWT_SECRET || '');
				// if (typeof decoded === 'string') {
				// 	throw new AuthError('Invalid LIL token payload');
				// }

				// if (decoded.iss === 'lil.lgcns.com') {
				const email = 'test12322245@lgcns.com';
				const firstName = 'first';
				const lastName = 'last';

				let user = await this.userRepository.findOne({ where: { email } });

				if (!user) {
					this.logger.debug('User not found, creating new user with personal project', { email });
					// personal project까지 함께 생성
					const { user: createdUser } = await this.userRepository.createUserWithProject({
						email,
						firstName,
						lastName,
						password: Math.random().toString(36).slice(-8),
						role: 'global:admin',
					});
					user = createdUser;
					this.logger.debug('New user and personal project created successfully', { email });
				}

				this.logger.debug('LIL token login successful', { email });
				this.authService.issueCookie(res, user, req.browserId);
				this.eventService.emit('user-logged-in', {
					user,
					authenticationMethod: 'email',
				});
				return await this.userService.toPublic(user, { posthog: this.postHog, withScopes: true });
			} catch (error: any) {
				this.logger.error('LIL token verification failed:', { error });
				throw new AuthError('Invalid LIL token');
			}
		}

		// lilToken이 없을 때 명시적으로 undefined 반환
		return undefined;
	}

	/** Check if the user is already logged in */
	@Get('/login')
	async currentUser(req: AuthenticatedRequest): Promise<PublicUser> {
		return await this.userService.toPublic(req.user, {
			posthog: this.postHog,
			withScopes: true,
		});
	}

	/** Validate invite token to enable invitee to set up their account */
	@Get('/resolve-signup-token', { skipAuth: true })
	async resolveSignupToken(
		_req: AuthlessRequest,
		_res: Response,
		@Query payload: ResolveSignupTokenQueryDto,
	) {
		const { inviterId, inviteeId } = payload;
		const isWithinUsersLimit = this.license.isWithinUsersLimit();

		if (!isWithinUsersLimit) {
			this.logger.debug('Request to resolve signup token failed because of users quota reached', {
				inviterId,
				inviteeId,
			});
			throw new ForbiddenError(RESPONSE_ERROR_MESSAGES.USERS_QUOTA_REACHED);
		}

		const users = await this.userRepository.findManyByIds([inviterId, inviteeId]);

		if (users.length !== 2) {
			this.logger.debug(
				'Request to resolve signup token failed because the ID of the inviter and/or the ID of the invitee were not found in database',
				{ inviterId, inviteeId },
			);
			throw new BadRequestError('Invalid invite URL');
		}

		const invitee = users.find((user) => user.id === inviteeId);
		if (!invitee || invitee.password) {
			this.logger.error('Invalid invite URL - invitee already setup', {
				inviterId,
				inviteeId,
			});
			throw new BadRequestError('The invitation was likely either deleted or already claimed');
		}

		const inviter = users.find((user) => user.id === inviterId);
		if (!inviter?.email || !inviter?.firstName) {
			this.logger.error(
				'Request to resolve signup token failed because inviter does not exist or is not set up',
				{
					inviterId: inviter?.id,
				},
			);
			throw new BadRequestError('Invalid request');
		}

		this.eventService.emit('user-invite-email-click', { inviter, invitee });

		const { firstName, lastName } = inviter;
		return { inviter: { firstName, lastName } };
	}

	/** Log out a user */
	@Post('/logout')
	async logout(req: AuthenticatedRequest, res: Response) {
		await this.authService.invalidateToken(req);
		this.authService.clearCookie(res);
		return { loggedOut: true };
	}
}
