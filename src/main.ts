import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from './config/configuration';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
	const app = await NestFactory.create<NestExpressApplication>(AppModule);
	const config = app.get(ConfigService<AppConfig, true>);

	app.enableCors({
		origin: config.get('cors.origin', { infer: true }),
		credentials: true
	});
	app.useBodyParser('json', {
		limit: `${config.get('http.bodyLimitKb', { infer: true })}kb`
	});
	app.enableShutdownHooks();

	if (config.get('storage.backend', { infer: true }) === 'local') {
		const dir = resolve(
			process.cwd(),
			config.get('storage.localDir', { infer: true })
		);
		mkdirSync(dir, { recursive: true });
		app.useStaticAssets(dir, {
			prefix: config.get('storage.localPublicPrefix', { infer: true })
		});
	}

	const port = config.get('port', { infer: true });
	await app.listen(port);
}

bootstrap();
