import { BadRequestException, Body, Controller, Delete, Get, Inject, Param, Patch, Post, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators'
import { AuthenticatedRequestUser, ClientRequestMeta } from '../auth/auth.types'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { PermissionsGuard } from '../auth/permissions.guard'
import { LearningResourceBody } from './learning.types'
import { normalizeLearningResourceBody } from './learning.validation'
import { LearningService } from './learning.service'

type UploadedImageFile = {
  buffer?: Buffer
  mimetype?: string
  originalname?: string
  size?: number
}

type RequestLike = {
  ip?: string
  path?: string
  headers?: {
    ['user-agent']?: string
    ['x-forwarded-for']?: string | string[]
  }
}

function getRequestMeta(req: RequestLike): ClientRequestMeta {
  const forwardedFor = req.headers?.['x-forwarded-for']
  const forwardedIp = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor

  return {
    ipAddress: forwardedIp?.split(',')[0]?.trim() || req.ip,
    userAgent: req.headers?.['user-agent'],
    requestPath: req.path,
  }
}

@Controller('learning')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class LearningController {
  constructor(@Inject(LearningService) private readonly learning: LearningService) {}

  @Get()
  listVisibleResources() {
    return this.learning.listVisibleResources()
  }

  @Post(':id/click')
  clickResource(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: RequestLike,
  ) {
    return this.learning.clickResource(id, user, getRequestMeta(req))
  }

  @Get('manage')
  @RequirePermissions('learning:manage')
  listManageResources() {
    return this.learning.listManageResources()
  }

  @Post('manage/upload-cover')
  @RequirePermissions('learning:manage')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 }, storage: undefined }))
  uploadCoverImage(@UploadedFile() file: UploadedImageFile | undefined) {
    if (!file) throw new BadRequestException('请选择图片文件')
    return this.learning.uploadCoverImage(file)
  }

  @Post()
  @RequirePermissions('learning:manage')
  createResource(
    @Body() body: LearningResourceBody,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: RequestLike,
  ) {
    const input = normalizeLearningResourceBody(body)
    return this.learning.createResource(input, user, getRequestMeta(req))
  }

  @Patch(':id')
  @RequirePermissions('learning:manage')
  updateResource(
    @Param('id') id: string,
    @Body() body: LearningResourceBody,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: RequestLike,
  ) {
    const input = normalizeLearningResourceBody(body)
    return this.learning.updateResource(id, input, user, getRequestMeta(req))
  }

  @Post(':id/enable')
  @RequirePermissions('learning:manage')
  enableResource(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: RequestLike,
  ) {
    return this.learning.setResourceActive(id, true, user, getRequestMeta(req))
  }

  @Post(':id/disable')
  @RequirePermissions('learning:manage')
  disableResource(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: RequestLike,
  ) {
    return this.learning.setResourceActive(id, false, user, getRequestMeta(req))
  }

  @Delete(':id')
  @RequirePermissions('learning:manage')
  deleteResource(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: RequestLike,
  ) {
    return this.learning.deleteResource(id, user, getRequestMeta(req))
  }
}
