import { User } from '@domain/user/User.entity';
import { AppDataSource } from '@config/data-source';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

@Injectable()
export class UserRepository {
  private readonly userRepository = AppDataSource.getRepository(User);

  async findById(id: string, relations?: string[]): Promise<User | null> {
    try {
      return this.userRepository.findOne({
        where: { id },
        relations: relations,
      });
    } catch (e) {
      console.error(e);
      throw new HttpException(
        'Error finding user',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    try {
      return this.userRepository.findOne({
        where: { email },
      });
    } catch (e) {
      console.error(e);
      throw new HttpException(
        'Error finding user',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async save(user: User): Promise<User> {
    try {
      return this.userRepository.save(user);
    } catch (e) {
      console.error(e);
      throw new HttpException(
        'Error saving user',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async remove(user: User): Promise<void> {
    try {
      await this.userRepository.remove(user);
    } catch (e) {
      console.error(e);
      throw new HttpException(
        'Error removing user',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
