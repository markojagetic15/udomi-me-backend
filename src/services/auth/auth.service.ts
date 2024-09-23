import { Response } from 'express';
import { Body, Injectable, Res } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { AppDataSource } from '@/config/data-source';
import { User } from '@/domain/user/User.entity';
import { encrypt } from '@/shared/encrypt';
import { RegisterDto } from '@/application/dto/auth/register.dto';
import { LoginDto } from '@/application/dto/auth/login.dto';

@Injectable()
export class AuthService {
  async login(@Body() body: LoginDto) {
    const { email, password } = body;

    const userRepository = AppDataSource.getRepository(User);

    const user = await userRepository.findOne({ where: { email } });

    if (!user) {
      return { message: 'User not found' };
    }

    const isPasswordValid = encrypt.comparepassword(user.password, password);

    if (!isPasswordValid) {
      return { message: 'Password is not valid' };
    }

    const token = encrypt.generateToken({ id: user.id });

    return { user, token };
  }

  async signup(@Body() body: RegisterDto) {
    const { first_name, last_name, email, password } = body;

    const encryptedPassword = await encrypt.encryptpass(password);

    const user = new User();

    user.id = uuidv4();
    user.first_name = first_name;
    user.last_name = last_name;
    user.email = email;
    user.password = encryptedPassword;
    user.created_at = new Date();
    user.updated_at = new Date();

    const userRepository = AppDataSource.getRepository(User);
    await userRepository.save(user);

    const token = encrypt.generateToken({ id: user.id });

    return { user, token };
  }
}
