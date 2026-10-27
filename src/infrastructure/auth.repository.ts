import { Injectable } from '@nestjs/common';
import { AppDataSource } from '@config/data-source';
import { PasswordResetToken } from '@domain/auth/PasswordResetToken.entity';
import { dbCall } from '@shared/db-call';

@Injectable()
export class AuthRepository {
  private readonly authRepository =
    AppDataSource.getRepository(PasswordResetToken);

  save(token: PasswordResetToken): Promise<PasswordResetToken> {
    return dbCall('saving token', () => this.authRepository.save(token));
  }

  findByToken(token: string): Promise<PasswordResetToken | null> {
    return dbCall('finding token', () =>
      this.authRepository.findOne({ where: { token } }),
    );
  }

  // Reset links are single-use: drop every outstanding token for the user.
  async deleteForUser(userId: string): Promise<void> {
    await dbCall('deleting tokens', () =>
      this.authRepository.delete({ userId }),
    );
  }
}
