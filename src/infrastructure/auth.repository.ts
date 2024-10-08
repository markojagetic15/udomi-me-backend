import { Injectable } from '@nestjs/common';
import { AppDataSource } from '@/config/data-source';
import { PasswordResetToken } from '@/domain/auth/PasswordResetToken.entity';

@Injectable()
export class AuthRepository {
  private readonly authRepository =
    AppDataSource.getRepository(PasswordResetToken);

  async save(token: PasswordResetToken): Promise<PasswordResetToken> {
    try {
      return this.authRepository.save(token);
    } catch (e) {
      console.error(e);
      throw new Error('Error saving token');
    }
  }

  async findByToken(token: string): Promise<PasswordResetToken | null> {
    try {
      return this.authRepository.findOne({ where: { token } });
    } catch (e) {
      console.error(e);
      throw new Error('Error finding token');
    }
  }
}
