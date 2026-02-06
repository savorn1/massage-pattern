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
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { TaskCommentsService } from './task-comments.service';
import { CreateTaskCommentDto, UpdateTaskCommentDto } from './dto';

@ApiTags('Task Comments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('admin/tasks/:taskId/comments')
export class TaskCommentsController {
  constructor(private readonly commentsService: TaskCommentsService) {}

  @Post()
  @ApiOperation({ summary: 'Add a comment to a task' })
  @ApiResponse({ status: 201, description: 'Comment added successfully' })
  async create(
    @Param('taskId') taskId: string,
    @Body() createCommentDto: CreateTaskCommentDto,
    @Request() req,
  ) {
    return this.commentsService.createComment(taskId, req.user.id, createCommentDto);
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
    return this.commentsService.getTaskComments(taskId, skip, limit);
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
