import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiConsumes,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { TaskCommentsService } from './task-comments.service';
import { CreateTaskCommentDto, UpdateTaskCommentDto } from './dto';
import { TaskEventsService } from '@/modules/admin/task-events/task-events.service';
import { ProjectMembersService } from '@/modules/admin/project-members/project-members.service';

@ApiTags('Task Comments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('admin/tasks/:taskId/comments')
export class TaskCommentsController {
  constructor(
    private readonly commentsService: TaskCommentsService,
    private readonly taskEvents: TaskEventsService,
    private readonly projectMembersService: ProjectMembersService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Add a comment to a task (supports optional file attachment)' })
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiResponse({ status: 201, description: 'Comment added successfully' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  )
  async create(
    @Param('taskId') taskId: string,
    @Body() body: CreateTaskCommentDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Request() req,
  ) {
    if (!body.content?.trim() && !file) {
      throw new BadRequestException('Comment must have content or an attached file');
    }
    const { comment, taskTitle, actorName, projectId } = await this.commentsService.createComment(taskId, req.user.id, body, file);

    // Extract mentioned user IDs from content — format: @[Name](24-char-hex-id)
    const mentionedUserIds: string[] = [];
    const mentionRegex = /@\[[^\]]+\]\(([a-f0-9]{24})\)/g;
    for (const match of (comment.content ?? '').matchAll(mentionRegex)) {
      if (match[1] && match[1] !== req.user.id) mentionedUserIds.push(match[1]);
    }

    // Resolve @[everyone] — add all project members except the actor
    if ((comment.content ?? '').includes('@[everyone]')) {
      const { data: members } = await this.projectMembersService.getProjectMembers(projectId, 0, 1000);
      for (const m of members) {
        const uid = m.userId.toString();
        if (uid !== req.user.id && !mentionedUserIds.includes(uid)) {
          mentionedUserIds.push(uid);
        }
      }
    }

    // Publish event via NATS — listeners handle activity logging + notifications async
    this.taskEvents.publishCommentAdded({
      taskId,
      taskTitle,
      userId: req.user.id,
      actorName,
      commentId: (comment._id as any).toString(),
      hasAttachment: !!file,
      content: comment.content ?? '',
      mentionedUserIds,
    });
    return comment;
  }

  @Get()
  @ApiOperation({ summary: 'Get all comments for a task' })
  @ApiResponse({ status: 200, description: 'List of comments' })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findAll(
    @Param('taskId') taskId: string,
    @Query('skip') skip?: number,
    @Query('limit') limit?: number,
  ) {
    return this.commentsService.getTaskCommentsWithDetails(taskId, skip, limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a comment by ID' })
  @ApiResponse({ status: 200, description: 'Comment details' })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  async findOne(@Param('id') id: string) {
    return this.commentsService.findCommentById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a comment' })
  @ApiResponse({ status: 200, description: 'Comment updated successfully' })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  async update(
    @Param('id') id: string,
    @Body() updateCommentDto: UpdateTaskCommentDto,
    @Request() req,
  ) {
    return this.commentsService.updateComment(id, req.user.id, updateCommentDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a comment' })
  @ApiResponse({ status: 200, description: 'Comment deleted successfully' })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  async remove(@Param('id') id: string, @Request() req) {
    return this.commentsService.deleteComment(id, req.user.id);
  }
}
