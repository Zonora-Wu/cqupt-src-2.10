import { BadRequestException, Injectable } from '@nestjs/common'

@Injectable()
export class SchoolPolicyService {
  async assertSchoolEmail(email: string) {
    const normalizedEmail = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      throw new BadRequestException('邮箱格式不正确')
    }
  }
}
