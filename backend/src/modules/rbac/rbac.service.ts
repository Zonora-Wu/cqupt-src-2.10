import { Inject, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class RbacService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getUserPermissionCodes(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        permissionOverrides: {
          include: {
            permission: true,
          },
        },
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    })

    if (!user) {
      return []
    }

    const permissions = new Set(user.role.permissions.map((item) => item.permission.code))

    for (const override of user.permissionOverrides) {
      if (override.enabled) {
        permissions.add(override.permission.code)
      } else {
        permissions.delete(override.permission.code)
      }
    }

    return [...permissions].sort()
  }

  async userHasPermission(userId: string, permissionCode: string) {
    const permissions = await this.getUserPermissionCodes(userId)
    return permissions.includes(permissionCode)
  }
}
