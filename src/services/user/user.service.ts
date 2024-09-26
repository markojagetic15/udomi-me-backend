import { Request } from 'express';
import * as jwt from 'jsonwebtoken';
import { JwtPayload } from 'jsonwebtoken';
import {
  Body,
  Injectable,
  NotFoundException,
  Param,
  UseGuards,
} from '@nestjs/common';
import { User } from '@/domain/user/User.entity';
import { AppDataSource } from '@/config/data-source';
import { UpdateUserDto } from '@/application/dto/user/update-user.dto';
import { JwtAuthGuard } from '@/shared/auth.guard';

@Injectable()
export class UserService {
  @UseGuards(JwtAuthGuard)
  async getMe(req: Request) {
    const header = req.headers.authorization;

    if (!header) {
      return { message: 'Unauthorized' };
    }

    const token = header.split(' ')[1];

    if (!token) {
      return { message: 'Unauthorized' };
    }

    const decode = jwt.decode(token);

    if (!decode) {
      return { message: 'Unauthorized' };
    }

    const userRepository = AppDataSource.getRepository(User);

    const user = await userRepository.findOne({
      where: { id: (decode as JwtPayload).id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return { user };
  }

  @UseGuards(JwtAuthGuard)
  async updateUser(@Param('id') id: string, @Body() body: UpdateUserDto) {
    if (!id) {
      return { message: 'Missing required fields' };
    }

    const { first_name, last_name, email } = body;
    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository.findOne({
      where: { id },
    });

    if (!user) {
      return { message: 'User not found' };
    }

    user.first_name = first_name;
    user.last_name = last_name;
    user.email = email;
    await userRepository.save(user);
    return { user };
  }

  @UseGuards(JwtAuthGuard)
  async deleteUser(@Param('id') id: string) {
    if (!id) {
      return { message: 'Missing required fields' };
    }

    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository.findOne({
      where: { id },
    });

    if (!user) {
      return { message: 'User not found' };
    }

    await userRepository.remove(user);
    return { message: 'user deleted' };
  }

  @UseGuards(JwtAuthGuard)
  async getMyUser(req: Request) {
    const header = req.headers.authorization;

    if (!header) return;

    const token = header.split(' ')[1];

    if (!token) return;

    const decode = jwt.decode(token);

    if (!decode) return;

    const userRepository = AppDataSource.getRepository(User);

    const user = await userRepository.findOne({
      where: { id: (decode as JwtPayload).id },
      relations: ['listings'],
    });

    if (!user) return;

    return user;
  }
}
