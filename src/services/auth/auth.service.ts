import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { User } from '@/domain/user/User.entity';
import { encrypt } from '@/shared/encrypt';
import { RegisterDto } from '@/application/dto/auth/register.dto';
import { LoginDto } from '@/application/dto/auth/login.dto';
import { UserRepository } from '@/infrastructure/user.repository';

@Injectable()
export class AuthService {
  constructor(private readonly userRepository: UserRepository) {}

  async login(body: LoginDto) {
    const { email, password } = body;

    const user = await this.userRepository.findByEmail(email);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isPasswordValid = encrypt.comparepassword(user.password, password);

    if (!isPasswordValid) {
      throw new HttpException('Password is not valid', HttpStatus.UNAUTHORIZED);
    }

    const token = encrypt.generateToken({ id: user.id });

    if (!token) {
      throw new HttpException(
        'Error generating token',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return { user, token };
  }

  async signup(body: RegisterDto) {
    const { first_name, last_name, email, password } = body;

    const existingUser = await this.userRepository.findByEmail(email);

    if (existingUser.email === email) {
      throw new HttpException(
        'Email is already registered',
        HttpStatus.CONFLICT,
      );
    }

    const encryptedPassword = await encrypt.encryptpass(password);

    if (!encryptedPassword) {
      throw new HttpException(
        'Error encrypting password',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const user = new User();

    user.id = uuidv4();
    user.first_name = first_name;
    user.last_name = last_name;
    user.email = email;
    user.password = encryptedPassword;

    const response = await this.userRepository.save(user);

    if (!response) {
      throw new HttpException(
        'Error saving user',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const token = encrypt.generateToken({ id: user.id });

    if (!token) {
      throw new HttpException(
        'Error generating token',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return { user, token };
  }
}
