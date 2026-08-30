import assert from 'node:assert/strict'
import test from 'node:test'
import { PATH_METADATA } from '@nestjs/common/constants'
import { NotificationsController } from '../src/modules/notifications/notifications.controller'
import { NotificationsService } from '../src/modules/notifications/notifications.service'

test('entity read endpoint cannot be captured by the notification id route', () => {
  const entityReadPath = Reflect.getMetadata(PATH_METADATA, NotificationsController.prototype.markEntityRead)
  const notificationReadPath = Reflect.getMetadata(PATH_METADATA, NotificationsController.prototype.markRead)

  assert.equal(entityReadPath, 'entities/mark-read')
  assert.equal(notificationReadPath, ':notificationId/read')
  assert.notEqual(entityReadPath.split('/')[1], 'read')
})

test('entity unread state is isolated by recipient and menu scope', async () => {
  let findArgs: Record<string, unknown> | undefined
  const prisma = {
    platformNotification: {
      findMany: async (args: Record<string, unknown>) => {
        findArgs = args
        return [
          { entityId: 'report-1', entityType: 'VulnerabilityReport' },
          { entityId: 'report-1', entityType: 'VulnerabilityReport' },
        ]
      },
    },
  }
  const service = new NotificationsService(prisma as never)
  const keys = await service.getUnreadEntityKeys('auditor-1', ['VulnerabilityReport'], ['auditor-retest'])

  assert.deepEqual(findArgs, {
    where: {
      entityId: { not: null },
      entityType: { in: ['VulnerabilityReport'] },
      menuScope: { in: ['auditor-retest'] },
      readAt: null,
      recipientId: 'auditor-1',
    },
    select: { entityId: true, entityType: true },
  })
  assert.deepEqual([...keys], ['VulnerabilityReport:report-1'])
})

test('marking entity read only clears the opened menu scope', async () => {
  let updateArgs: Record<string, unknown> | undefined
  const prisma = {
    platformNotification: {
      updateMany: async (args: Record<string, unknown>) => {
        updateArgs = args
        return { count: 1 }
      },
    },
  }
  const service = new NotificationsService(prisma as never)
  await service.markEntityRead('admin-1', 'VulnerabilityReport', 'report-1', 'admin-vulnerabilities')

  assert.deepEqual(updateArgs?.where, {
    entityId: 'report-1',
    entityType: 'VulnerabilityReport',
    menuScope: 'admin-vulnerabilities',
    readAt: null,
    recipientId: 'admin-1',
  })
  assert.equal((updateArgs?.data as { readAt: unknown }).readAt instanceof Date, true)
})

test('legacy entity read calls still clear all menu scopes for that entity', async () => {
  let updateArgs: Record<string, unknown> | undefined
  const prisma = {
    platformNotification: {
      updateMany: async (args: Record<string, unknown>) => {
        updateArgs = args
        return { count: 2 }
      },
    },
  }
  const service = new NotificationsService(prisma as never)
  await service.markEntityRead('user-1', 'Certificate', 'certificate-1')

  assert.deepEqual(updateArgs?.where, {
    entityId: 'certificate-1',
    entityType: 'Certificate',
    menuScope: undefined,
    recipientId: 'user-1',
    readAt: null,
  })
  assert.equal((updateArgs?.data as { readAt: unknown }).readAt instanceof Date, true)
})
