import { Module } from '@nestjs/common';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';
import { POSTS_REPOSITORY } from './repositories/posts.repository';
import { PrismaPostsRepository } from './repositories/prisma-posts.repository';
import { AuthModule } from 'src/auth/auth.module';
import { TrendingService } from './trending.service';
// import { InMemoryPostsRepository } from './repositories/in-memory-posts.repository';

@Module({
	imports: [AuthModule],
	controllers: [PostsController],
	providers: [
		PostsService,
		TrendingService,
		{ provide: POSTS_REPOSITORY, useClass: PrismaPostsRepository }
	]
})
export class PostsModule {}
