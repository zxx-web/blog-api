import {
	Controller,
	Get,
	Post,
	Body,
	Patch,
	Param,
	Delete,
	Query,
	HttpCode,
	HttpStatus,
	UseFilters,
	ParseUUIDPipe,
	UseGuards,
	UseInterceptors,
	UploadedFile
} from '@nestjs/common';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { QueryPostDto } from './dto/query-post.dto';
// import { Public } from 'src/common/decorators/public.decorator';
// import { Roles } from 'src/common/decorators/roles.decorator';
import { BusinessExceptionFilter } from 'src/common/filters/business-exception.filter';
import { SearchPostDto } from './dto/search-post.dto';
import { JwtAuthGuard, type JwtPayload } from 'src/auth/guards/jwt-auth.guard';
import { currentUser } from 'src/auth/decorators/current-user.decorator';
import { CoverUploadInterceptor } from 'src/storage/cover-upload.interceptor';

@UseFilters(BusinessExceptionFilter)
@Controller('posts')
export class PostsController {
	constructor(private readonly postsService: PostsService) {}

	@Post()
	@HttpCode(HttpStatus.CREATED)
	@UseGuards(JwtAuthGuard)
	create(
		@Body() createPostDto: CreatePostDto,
		@currentUser() user: JwtPayload
	) {
		return this.postsService.create(createPostDto, user.sub);
	}

	// @Public()
	@Get()
	findAll(@Query() query: QueryPostDto) {
		return this.postsService.findAll(query);
	}

	// @Public()
	@Get('debug/boom')
	boom() {
		return this.postsService.triggerBoom();
	}

	@Get('feed')
	feed(@Query() query: QueryPostDto) {
		return this.postsService.feed(query);
	}

	@Get('search')
	search(@Query() query: SearchPostDto) {
		return this.postsService.search(query);
	}

	@Get('trending')
	trending(@Query('limit') rawlimit?: string) {
		const n = Number(rawlimit);
		const limit =
			Number.isFinite(n) && n > 0 ? Math.min(Math.trunc(n), 50) : 10;
		return this.postsService.trending(limit);
	}

	// @Public()
	@Get(':id')
	findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
		return this.postsService.findOne(id);
	}

	@Get(':id/revisions')
	revisions(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
		return this.postsService.listRevisions(id);
	}

	@Post(':id/view')
	incrementView(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
		return this.postsService.incrementView(id);
	}

	@Post(':id/cover')
	@HttpCode(HttpStatus.OK)
	@UseGuards(JwtAuthGuard)
	@UseInterceptors(CoverUploadInterceptor)
	uploadCover(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@UploadedFile() file: Express.Multer.File,
		@currentUser() user: JwtPayload
	) {
		return this.postsService.uploadCover(id, file, user);
	}

	@Patch(':id')
	@UseGuards(JwtAuthGuard)
	update(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() updatePostDto: UpdatePostDto,
		@currentUser() user: JwtPayload
	) {
		return this.postsService.update(id, updatePostDto, user);
	}

	// @Roles('admin')
	@Delete(':id')
	@UseGuards(JwtAuthGuard)
	remove(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@currentUser() user: JwtPayload
	) {
		return this.postsService.remove(id, user);
	}
}
