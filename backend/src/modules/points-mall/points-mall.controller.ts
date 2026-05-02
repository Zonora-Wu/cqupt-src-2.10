import { BadRequestException, Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { MallProductStatus } from '@prisma/client'
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators'
import { AuthenticatedRequestUser, ClientRequestMeta } from '../auth/auth.types'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { PermissionsGuard } from '../auth/permissions.guard'
import { MallHandleRedemptionBody, MallProductBody, MallRedemptionBody } from './points-mall.types'
import {
  normalizeHandleRedemptionBody,
  normalizeMallProductBody,
  normalizeRedemptionBody,
} from './points-mall.validation'
import { PointsMallService } from './points-mall.service'

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
    requestPath: req.path,
    userAgent: req.headers?.['user-agent'],
  }
}

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PointsMallController {
  constructor(@Inject(PointsMallService) private readonly pointsMall: PointsMallService) {}

  @Get('leaderboard')
  getLeaderboard(
    @Query('scope') scope: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    const validScope = scope === 'month' || scope === 'week' ? scope : 'all'
    return this.pointsMall.getLeaderboard(validScope, user.id)
  }

  @Get('points/summary')
  @RequirePermissions('point:read')
  getPointSummary(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.pointsMall.getPointSummary(user)
  }

  @Get('points/ledger')
  @RequirePermissions('point:read')
  listMyPointLedger(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.pointsMall.listMyPointLedger(user)
  }

  @Get('mall/products')
  listVisibleProducts(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.pointsMall.listVisibleProducts(user)
  }

  @Get('mall/redemptions/my')
  @RequirePermissions('mall:redeem')
  listMyRedemptions(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.pointsMall.listMyRedemptions(user)
  }

  @Post('mall/redemptions')
  @RequirePermissions('mall:redeem')
  createRedemption(@Body() body: MallRedemptionBody, @CurrentUser() user: AuthenticatedRequestUser) {
    const input = normalizeRedemptionBody(body)
    return this.pointsMall.createRedemption(input.productId, user)
  }

  @Get('mall/manage/products')
  @RequirePermissions('mall:manage')
  listManageProducts() {
    return this.pointsMall.listManageProducts()
  }

  @Post('mall/manage/products')
  @RequirePermissions('mall:manage')
  createProduct(
    @Body() body: MallProductBody,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: RequestLike,
  ) {
    const input = normalizeMallProductBody(body)
    return this.pointsMall.createProduct(input, user, getRequestMeta(req))
  }

  @Patch('mall/manage/products/:id')
  @RequirePermissions('mall:manage')
  updateProduct(
    @Param('id') id: string,
    @Body() body: MallProductBody,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: RequestLike,
  ) {
    const input = normalizeMallProductBody(body)
    return this.pointsMall.updateProduct(id, input, user, getRequestMeta(req))
  }

  @Post('mall/manage/products/:id/activate')
  @RequirePermissions('mall:manage')
  activateProduct(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: RequestLike,
  ) {
    return this.pointsMall.setProductStatus(id, MallProductStatus.ACTIVE, user, getRequestMeta(req))
  }

  @Post('mall/manage/products/:id/deactivate')
  @RequirePermissions('mall:manage')
  deactivateProduct(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: RequestLike,
  ) {
    return this.pointsMall.setProductStatus(id, MallProductStatus.INACTIVE, user, getRequestMeta(req))
  }

  @Delete('mall/manage/products/:id')
  @RequirePermissions('mall:manage')
  deleteProduct(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: RequestLike,
  ) {
    return this.pointsMall.deleteProduct(id, user, getRequestMeta(req))
  }

  @Post('mall/manage/products/upload-image')
  @RequirePermissions('mall:manage')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 }, storage: undefined }))
  uploadProductImage(@UploadedFile() file: UploadedImageFile | undefined) {
    if (!file) throw new BadRequestException('请选择图片文件')
    return this.pointsMall.uploadProductImage(file)
  }

  @Get('mall/manage/redemptions')
  @RequirePermissions('mall:manage')
  listManageRedemptions() {
    return this.pointsMall.listManageRedemptions()
  }

  @Post('mall/manage/redemptions/:id/complete')
  @RequirePermissions('mall:manage')
  completeRedemption(
    @Param('id') id: string,
    @Body() body: MallHandleRedemptionBody,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: RequestLike,
  ) {
    const input = normalizeHandleRedemptionBody(body)
    return this.pointsMall.completeRedemption(id, input.note, user, getRequestMeta(req))
  }

  @Post('mall/manage/redemptions/:id/cancel')
  @RequirePermissions('mall:manage')
  cancelRedemption(
    @Param('id') id: string,
    @Body() body: MallHandleRedemptionBody,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: RequestLike,
  ) {
    const input = normalizeHandleRedemptionBody(body)
    return this.pointsMall.cancelRedemption(id, input.note, user, getRequestMeta(req))
  }
}
