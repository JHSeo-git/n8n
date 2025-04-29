import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Container } from '@n8n/di';
import { Logger } from 'n8n-core';

const logger = Container.get(Logger);

// Request 타입 확장
declare global {
	namespace Express {
		interface Request {
			user?: any;
		}
	}
}

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
	try {
		// Skip authentication for certain paths
		if (req.path.startsWith('/rest/login') || req.path.startsWith('/rest/signup')) {
			return next();
		}

		// Get token from header
		const authHeader = req.headers.authorization;
		if (!authHeader) {
			return res.status(401).json({ message: 'No token provided' });
		}

		const token = authHeader.split(' ')[1];
		if (!token) {
			return res.status(401).json({ message: 'No token provided' });
		}

		// Verify token
		try {
			const decoded = jwt.verify(token, process.env.N8N_USER_MANAGEMENT_JWT_SECRET || '');

			// LIL 토큰인 경우 추가 검증
			if (decoded.iss === 'lil.lgcns.com') {
				// LIL 토큰 검증 로직 추가
				// 예: LIL 서버에 토큰 검증 요청 등
			}

			req.user = decoded;
			next();
		} catch (error) {
			logger.error('JWT verification failed:', { error });
			return res.status(401).json({ message: 'Invalid token' });
		}
	} catch (error) {
		logger.error('Authentication error:', { error });
		return res.status(500).json({ message: 'Internal server error' });
	}
};
