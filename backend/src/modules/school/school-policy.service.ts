import { BadRequestException, Inject, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class SchoolPolicyService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async assertSchoolEmail(email: string) {
    const domains = await this.getAllowedEmailDomains()
    if (domains.length === 0) {
      return
    }

    const normalizedEmail = email.trim().toLowerCase()
    const allowed = domains.some(
      (domain) => normalizedEmail.endsWith(`@${domain}`) || normalizedEmail.endsWith(`.${domain}`),
    )

    if (!allowed) {
      throw new BadRequestException(`仅允许校内邮箱：${domains.join('、')}`)
    }
  }

  async getAllowedEmailDomains() {
    const defaultDomains = ['cqupt.edu.cn', 'example.edu.cn']
    const envDomains = (process.env.SCHOOL_EMAIL_DOMAINS ?? '')
      .split(',')
      .map(normalizeDomain)
      .filter(Boolean)

    const profiles = await this.prisma.schoolProfile.findMany({
      select: { emailDomain: true },
      where: { emailDomain: { not: null } },
      take: 10,
    })

    const profileDomains = profiles
      .map((profile) => normalizeDomain(profile.emailDomain ?? ''))
      .filter(Boolean)

    return Array.from(new Set([...envDomains, ...profileDomains, ...defaultDomains]))
  }
}

function normalizeDomain(domain: string) {
  return domain.trim().toLowerCase().replace(/^@/, '')
}
