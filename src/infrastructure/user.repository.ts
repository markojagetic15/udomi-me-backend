import { User } from '@/domain/user/User.entity';
import { AppDataSource } from '@/config/data-source';
import { Injectable } from '@nestjs/common';

@Injectable()
export class UserRepository {
  private readonly userRepository = AppDataSource.getRepository(User);

  async findById(id: string, relations?: string[]): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id },
      relations: relations,
    });
  }

  async save(user: User): Promise<User> {
    return this.userRepository.save(user);
  }

  async remove(user: User): Promise<void> {
    await this.userRepository.remove(user);
  }
}
