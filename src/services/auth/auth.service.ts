import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { User } from '@domain/user/User.entity';
import { encrypt } from '@shared/encrypt';
import { RegisterDto } from '@application/dto/auth/register.dto';
import { LoginDto } from '@application/dto/auth/login.dto';
import { UserRepository } from '@infrastructure/user.repository';
import { ForgotPasswordDto } from '@application/dto/auth/forgot-password.dto';
import { AuthRepository } from '@infrastructure/auth.repository';
import { ResetPasswordDto } from '@application/dto/auth/reset-password.dto';
import { EmailParams, MailerSend, Recipient, Sender } from 'mailersend';
import { Response } from 'express';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private readonly userRepository: UserRepository,
    private readonly authRepository: AuthRepository,
  ) {}

  async login(body: LoginDto, res: Response) {
    const { email, password } = body;

    const user = await this.userRepository.findByEmail(email);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isPasswordValid = encrypt.comparepassword(user.password, password);

    if (!isPasswordValid) {
      throw new HttpException(
        {
          message: 'Password is incorrect',
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const token = encrypt.generateToken({ id: user.id });

    res.cookie('token', token, {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
    });

    if (!token) {
      throw new HttpException(
        'Error generating token',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return user;
  }

  async signup(body: RegisterDto, res: Response) {
    const { first_name, last_name, email, password } = body;

    const existingUser = await this.userRepository.findByEmail(email);

    if (existingUser?.email === email) {
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

    res.cookie('token', token, {
      httpOnly: true,
      secure: false,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: 'none',
    });

    if (!token) {
      throw new HttpException(
        'Error generating token',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return user;
  }

  async forgotPassword(body: ForgotPasswordDto) {
    const { email } = body;

    const user = await this.userRepository.findByEmail(email);

    const token = {
      token: uuidv4(),
      userId: user.id,
      expiration: new Date(Date.now() + 3600000),
    };

    await this.authRepository.save(token);

    const mailerSend = new MailerSend({
      apiKey: process.env.MAILERSEND_API_KEY,
    });

    const sentFrom = new Sender(
      process.env.SUPPORT_EMAIL,
      process.env.BUSINESS_NAME,
    );

    const recipients = [
      new Recipient(user.email, `${user.first_name} ${user.last_name}`),
    ];

    const personalization = [
      {
        email: user.email,
        data: {
          name: `${user.first_name} ${user.last_name}`,
          account_name: process.env.BUSINESS_NAME,
          support_email: process.env.SUPPORT_EMAIL,
          token: token.token,
        },
      },
    ];

    const emailParams = new EmailParams()
      .setFrom(sentFrom)
      .setTo(recipients)
      .setReplyTo(sentFrom)
      .setSubject('Reset your password')
      .setTemplateId(process.env.MAILERSEND_TEMPLATE_ID)
      .setPersonalization(personalization);

    await mailerSend.email.send(emailParams);

    return new HttpException('Email sent', HttpStatus.OK);
  }

  async resetPassword(body: ResetPasswordDto) {
    const { token, password } = body;
    const tokenData = await this.authRepository.findByToken(token);

    if (!tokenData) {
      throw new HttpException('Token not found', HttpStatus.NOT_FOUND);
    }

    if (tokenData.expiration < new Date()) {
      throw new HttpException('Token expired', HttpStatus.BAD_REQUEST);
    }

    const user = await this.userRepository.findById(tokenData.userId);

    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    const encryptedPassword = await encrypt.encryptpass(password);

    if (!encryptedPassword) {
      throw new HttpException(
        'Error encrypting password',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    user.password = encryptedPassword;

    await this.userRepository.save(user);

    return new HttpException('Password reset successfully', HttpStatus.OK);
  }

  async logout(res: Response) {
    res.clearCookie('token');
    res.cookie('token', '', {});
    return new HttpException('Logged out', HttpStatus.OK);
  }

  async googleLoginAndRegister(
    profile: {
      email: string;
      firstName: string;
      lastName: string;
    },
    res: Response,
  ) {
    const user = await this.userRepository.findByEmail(profile.email);
    if (!user) {
      const newUser = await this.userRepository.save({
        email: profile.email,
        first_name: profile.firstName,
        last_name: profile.lastName,
        created_at: new Date(),
        updated_at: new Date(),
        id: uuidv4(),
        password: '',
        listings: [],
        favorite_listings: [],
        interested_listings: [],
      });

      await this.userRepository.save(newUser);
    }

    const token = encrypt.generateToken({ id: user.id });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.redirect(
      `http://localhost:3000/google-callback?token=${token}&user=${encodeURIComponent(
        JSON.stringify(user),
      )}`,
    );
  }
}
