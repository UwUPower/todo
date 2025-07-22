import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  UseInterceptors,
  ClassSerializerInterceptor,
  Patch,
  Param,
  Get,
  Query,
  BadRequestException,
  HttpCode,
  HttpStatus,
  Delete,
} from '@nestjs/common';
import { TodoService } from './todo.service';
import {
  CreateTodoRequestDto,
  CreateTodoResponseDto,
} from './dtos/create-todo.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Request } from 'express';
import { plainToInstance } from 'class-transformer';
import {
  ApiBearerAuth,
  ApiBody,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { User } from '../user/entities/user.entity';
import {
  UpdateTodoRequestDto,
  UpdateTodoResponseDto,
} from './dtos/update-todo.dto';
import { GetTodoResponseDto } from './dtos/get-todo.dto';
import { ToDoQueryEnum } from './enums';
import { InviteUserRequestDto } from './dtos/invite-user.dto';
import { UpdateUserRoleRequestDto } from './dtos/update-user-role.dto';
import { RemoveUserPermissionRequestDto } from './dtos/romve-user-permission.dto';
import { GetUserTodoRoleResponseDto } from './dtos/get-todo-user-role.dto';

@ApiTags('Todo')
@ApiBearerAuth('JWT-auth')
@Controller('todo')
@UseGuards(JwtAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class TodoController {
  constructor(private readonly todoService: TodoService) {}

  @Post()
  @ApiBody({
    type: CreateTodoRequestDto,
    description: 'Data for creating a new todo item',
  })
  @ApiResponse({
    status: 201,
    description: 'The todo has been successfully created.',
    type: CreateTodoResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 400, description: 'Invalid input.' })
  async create(
    @Body() createTodoRequestDto: CreateTodoRequestDto,
    @Req() req: Request,
  ): Promise<CreateTodoResponseDto> {
    const user = req.user as User;
    const todo = await this.todoService.createTodo(
      createTodoRequestDto,
      user.id,
    );
    return plainToInstance(CreateTodoResponseDto, todo);
  }

  @Patch(':uuid') // Using Patch for partial updates
  @ApiParam({ name: 'uuid', description: 'UUID of the todo item to update.' })
  @ApiBody({
    type: UpdateTodoRequestDto,
    description: 'Data for updating an existing todo item',
  })
  @ApiResponse({
    status: 200,
    description: 'The todo has been successfully updated.',
    type: UpdateTodoResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({
    status: 403,
    description:
      'Forbidden: User does not have permission to update this todo.',
  })
  @ApiResponse({ status: 404, description: 'Todo not found.' })
  async update(
    @Param('uuid') uuid: string,
    @Body() updateTodoRequestDto: UpdateTodoRequestDto,
    @Req() req: Request,
  ): Promise<UpdateTodoResponseDto> {
    const user = req.user as User;
    const todo = await this.todoService.updateTodo(
      uuid,
      updateTodoRequestDto,
      user.id,
    );
    return plainToInstance(UpdateTodoResponseDto, todo);
  }

  @Get(':uuid')
  @ApiParam({ name: 'uuid', description: 'UUID of the todo item to retrieve.' })
  @ApiQuery({
    name: 'fields',
    required: false,
    type: String,
    description:
      'Comma-separated list of fields to return. Allowed options: uuid, name, description, dueDate, status, priority, tags',
    example: 'name',
  })
  @ApiResponse({
    status: 200,
    description: 'Details of the todo item.',
    type: GetTodoResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid selction fields.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({
    status: 403,
    description:
      'Forbidden: User does not have permission to access this todo.',
  })
  @ApiResponse({ status: 404, description: 'Todo not found.' })
  async getAuthorizedTodo(
    @Param('uuid') uuid: string,
    @Req() req: Request,
    @Query('fields') fields?: string,
  ): Promise<Partial<GetTodoResponseDto>> {
    const user = req.user as User;
    const allowedFields = Object.values(ToDoQueryEnum);

    let fieldsArray: string[] = [];
    if (fields) {
      fieldsArray = fields.split(',');
      const invalidFields = fieldsArray.filter(
        (field) => !allowedFields.includes(field as ToDoQueryEnum),
      );
      if (invalidFields.length > 0) {
        throw new BadRequestException(
          `Invalid field(s) requested: ${invalidFields.join(', ')}. Allowed fields are: ${allowedFields.join(', ')}.`,
        );
      }
    }
    const todoPartial = await this.todoService.getAuthorizedTodo(
      uuid,
      user.id,
      fieldsArray,
    );
    return plainToInstance(GetTodoResponseDto, todoPartial);
  }

  @Delete(':uuid')
  @ApiParam({
    name: 'uuid',
    description: 'UUID of the todo item to soft-delete.',
  })
  @ApiResponse({ status: 204, description: 'Todo successfully soft-deleted.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({
    status: 403,
    description:
      'Forbidden: User does not have permission to soft-delete this todo.',
  })
  @ApiResponse({ status: 404, description: 'Todo not found.' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async softDelete(
    @Param('uuid') uuid: string,
    @Req() req: Request,
  ): Promise<void> {
    const user = req.user as User;
    await this.todoService.softDelete(uuid, user.id);
  }

  @Post(':uuid/invite')
  @ApiParam({
    name: 'uuid',
    description: 'UUID of the todo',
  })
  @ApiBody({
    type: InviteUserRequestDto,
    description: 'Data for inviting a user to a todo with a specific role.',
  })
  @ApiResponse({
    status: 200,
    description: 'User successfully invited to todo.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden: Only owner can invite users to a todo.',
  })
  @ApiResponse({ status: 404, description: 'Todo or invited user not found.' })
  @ApiResponse({
    status: 409,
    description: 'User already assigned to this todo.',
  })
  async inviteUserToTodo(
    @Param('uuid') todoUuid: string,
    @Body() inviteUserRequestDto: InviteUserRequestDto,
    @Req() req: Request,
  ): Promise<void> {
    const user = req.user as User;
    await this.todoService.inviteUserToTodo(
      todoUuid,
      user.id,
      inviteUserRequestDto.email,
      inviteUserRequestDto.role,
    );
  }

  @Patch(':uuid/role')
  @ApiParam({
    name: 'uuid',
    description: 'UUID of the todo',
  })
  @ApiBody({
    type: UpdateUserRoleRequestDto,
    description: "Data for updating a user's role on a todo.",
  })
  @ApiResponse({ status: 200, description: 'User role successfully updated.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden: Only owner can update user roles on a todo.',
  })
  @ApiResponse({
    status: 404,
    description: 'Todo or target user not found for this todo.',
  })
  @HttpCode(HttpStatus.OK)
  async updateUserRoleOnTodo(
    @Param('uuid') todoUuid: string,
    @Body() updateUserRoleRequestDto: UpdateUserRoleRequestDto,
    @Req() req: Request,
  ): Promise<void> {
    const user = req.user as User;
    await this.todoService.updateUserRole(
      todoUuid,
      user.id,
      updateUserRoleRequestDto.email,
      updateUserRoleRequestDto.role,
    );
  }

  @Get(':uuid/user-role')
  @ApiParam({ name: 'uuid', description: 'UUID of the todo item to retrieve.' })
  @ApiResponse({
    status: 200,
    description: 'Role of user of that todo',
    type: GetUserTodoRoleResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid selction fields.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({
    status: 403,
    description:
      'Forbidden: User does not have permission to access this todo.',
  })
  @ApiResponse({ status: 404, description: 'Todo not found.' })
  async getTodoUserRole(
    @Param('uuid') uuid: string,
    @Req() req: Request,
  ): Promise<GetUserTodoRoleResponseDto> {
    const user = req.user as User;
    const todoPartial = await this.todoService.getTodoUserRole(uuid, user.id);
    return plainToInstance(GetUserTodoRoleResponseDto, todoPartial);
  }

  @Delete(':uuid/user-permission')
  @ApiParam({
    name: 'uuid',
    description: 'UUID of the todo item from which to remove user permission.',
  })
  @ApiBody({
    type: RemoveUserPermissionRequestDto,
    description: 'Email of the user whose permission is to be removed.',
  })
  @ApiResponse({
    status: 200,
    description: 'User permission successfully removed.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden: Only the owner can remove user permissions.',
  })
  @ApiResponse({
    status: 404,
    description: 'Todo or target user/permission not found.',
  })
  @HttpCode(HttpStatus.OK)
  async removeUserPermission(
    @Param('uuid') todoUuid: string,
    @Body() removeUserPermissionRequestDto: RemoveUserPermissionRequestDto,
    @Req() req: Request,
  ): Promise<void> {
    const user = req.user as User;
    await this.todoService.removeUserPermissionFromTodo(
      todoUuid,
      user.id,
      removeUserPermissionRequestDto.email,
    );
  }
}
