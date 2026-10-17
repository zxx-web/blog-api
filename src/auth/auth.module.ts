import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AppConfig } from 'src/config/configuration';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokensService } from './tokens.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { GithubOauthProvider } from './oauth/github-oauth.provider';
import { OauthStateStore } from './oauth/oauth-state.store';

@Module({
	imports: [
		JwtModule.registerAsync({
			inject: [ConfigService],
			useFactory: (config: ConfigService<AppConfig, true>) => ({
				secret: config.get('auth.accessSecret', { infer: true }),
				signOptions: {
					algorithm: 'HS256',
					expiresIn: config.get('auth.accessTtl', { infer: true })
				},
				verifyOptions: { algorithms: ['HS256'] }
			})
		})
	],
	controllers: [AuthController],
	providers: [
		AuthService,
		TokensService,
		JwtAuthGuard,
		RolesGuard,
		GithubOauthProvider,
		OauthStateStore
	],
	exports: [JwtAuthGuard, JwtModule, RolesGuard]
})
export class AuthModule {}
