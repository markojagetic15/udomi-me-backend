import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
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

  private setAuthCookie(res: Response, token: string) {
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  private async sendEmail(
    to: { email: string; name: string },
    subject: string,
    html: string,
  ) {
    if (!process.env.MAILERSEND_API_KEY) return;
    try {
      const mailerSend = new MailerSend({ apiKey: process.env.MAILERSEND_API_KEY });
      const sentFrom = new Sender(process.env.SUPPORT_EMAIL, process.env.BUSINESS_NAME);
      const emailParams = new EmailParams()
        .setFrom(sentFrom)
        .setTo([new Recipient(to.email, to.name)])
        .setReplyTo(sentFrom)
        .setSubject(subject)
        .setHtml(html);
      await mailerSend.email.send(emailParams);
    } catch (e) {
      console.error('Email send failed:', e?.message);
    }
  }

  async login(body: LoginDto, res: Response) {
    const { email, password } = body;
    const user = await this.userRepository.findByEmail(email);

    if (!user) {
      throw new NotFoundException('No account found with this email address');
    }

    if (!user.password) {
      throw new UnauthorizedException(
        'This account was created with Google. Please sign in with Google.',
      );
    }

    const isPasswordValid = await encrypt.comparepassword(user.password, password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Incorrect password. Please try again.');
    }

    const token = encrypt.generateToken({ id: user.id });
    this.setAuthCookie(res, token);
    return user;
  }

  async signup(body: RegisterDto, res: Response) {
    const { first_name, last_name, email, password } = body;

    const existingUser = await this.userRepository.findByEmail(email);
    if (existingUser) {
      if (!existingUser.password) {
        throw new HttpException(
          'This email is already registered with Google. Please sign in with Google.',
          HttpStatus.CONFLICT,
        );
      }
      throw new HttpException(
        'An account with this email already exists.',
        HttpStatus.CONFLICT,
      );
    }

    const encryptedPassword = await encrypt.encryptpass(password);
    const verificationToken = uuidv4();

    const user = new User();
    user.id = uuidv4();
    user.first_name = first_name;
    user.last_name = last_name;
    user.email = email;
    user.password = encryptedPassword;
    user.is_verified = false;
    user.verification_token = verificationToken;

    await this.userRepository.save(user);

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    await this.sendEmail(
      { email, name: `${first_name} ${last_name}` },
      'Verify your Udomi Me account',
      `
        <div style="font-family:sans-serif;max-width:480px;margin:auto">
          <h2>Welcome to Udomi Me, ${first_name}!</h2>
          <p>Click the button below to verify your email address.</p>
          <a href="${frontendUrl}/verify-email?token=${verificationToken}"
            style="display:inline-block;padding:12px 24px;background:#8EAF9D;color:white;text-decoration:none;border-radius:8px;font-weight:600">
            Verify Email
          </a>
          <p style="color:#888;font-size:12px;margin-top:24px">
            If you didn't create this account, you can ignore this email.
          </p>
        </div>
      `,
    );

    const token = encrypt.generateToken({ id: user.id });
    this.setAuthCookie(res, token);
    return user;
  }

  async verifyEmail(token: string) {
    const user = await this.userRepository.findByVerificationToken(token);
    if (!user) {
      throw new HttpException('Invalid or expired verification link.', HttpStatus.BAD_REQUEST);
    }
    user.is_verified = true;
    user.verification_token = null;
    await this.userRepository.save(user);
    return { message: 'Email verified successfully' };
  }

  async changePassword(
    authToken: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const jwt = require('jsonwebtoken');
    let decoded: any;
    try {
      decoded = jwt.decode(authToken);
    } catch {
      throw new UnauthorizedException('Invalid token');
    }

    const user = await this.userRepository.findById(decoded?.id);
    if (!user) throw new NotFoundException('User not found');

    if (!user.password) {
      throw new HttpException(
        'Google accounts cannot change password here.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const isValid = await encrypt.comparepassword(user.password, currentPassword);
    if (!isValid) {
      throw new UnauthorizedException('Current password is incorrect.');
    }

    user.password = await encrypt.encryptpass(newPassword);
    await this.userRepository.save(user);
    return { message: 'Password changed successfully' };
  }

  async forgotPassword(body: ForgotPasswordDto) {
    const { email } = body;
    const user = await this.userRepository.findByEmail(email);

    if (!user) {
      return { message: 'If that email exists, a reset link has been sent.' };
    }

    if (!user.password) {
      throw new HttpException(
        'This account uses Google sign-in. Password reset is not available.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const token = { token: uuidv4(), userId: user.id, expiration: new Date(Date.now() + 3600000) };
    await this.authRepository.save(token);

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    if (process.env.MAILERSEND_API_KEY && process.env.MAILERSEND_TEMPLATE_ID) {
      try {
        const mailerSend = new MailerSend({ apiKey: process.env.MAILERSEND_API_KEY });
        const sentFrom = new Sender(process.env.SUPPORT_EMAIL, process.env.BUSINESS_NAME);
        const emailParams = new EmailParams()
          .setFrom(sentFrom)
          .setTo([new Recipient(user.email, `${user.first_name} ${user.last_name}`)])
          .setReplyTo(sentFrom)
          .setSubject('Reset your password')
          .setTemplateId(process.env.MAILERSEND_TEMPLATE_ID)
          .setPersonalization([{
            email: user.email,
            data: {
              name: `${user.first_name} ${user.last_name}`,
              account_name: process.env.BUSINESS_NAME,
              support_email: process.env.SUPPORT_EMAIL,
              token: token.token,
            },
          }]);
        await mailerSend.email.send(emailParams);
      } catch (e) {
        console.error('Password reset email failed:', e?.message);
      }
    } else {
      await this.sendEmail(
        { email: user.email, name: `${user.first_name} ${user.last_name}` },
        'Reset your Udomi Me password',
        `
          <div style="font-family:sans-serif;max-width:480px;margin:auto">
            <h2>Reset your password</h2>
            <p>Click the button below to reset your password. This link expires in 1 hour.</p>
            <a href="${frontendUrl}/reset-password?token=${token.token}"
              style="display:inline-block;padding:12px 24px;background:#8EAF9D;color:white;text-decoration:none;border-radius:8px;font-weight:600">
              Reset Password
            </a>
          </div>
        `,
      );
    }

    return { message: 'If that email exists, a reset link has been sent.' };
  }

  async resetPassword(body: ResetPasswordDto) {
    const { token, password } = body;
    const tokenData = await this.authRepository.findByToken(token);

    if (!tokenData) throw new HttpException('Invalid or expired reset link.', HttpStatus.BAD_REQUEST);
    if (tokenData.expiration < new Date()) throw new HttpException('Reset link has expired.', HttpStatus.BAD_REQUEST);

    const user = await this.userRepository.findById(tokenData.userId);
    if (!user) throw new HttpException('User not found', HttpStatus.NOT_FOUND);

    user.password = await encrypt.encryptpass(password);
    await this.userRepository.save(user);
    return { message: 'Password reset successfully' };
  }

  async logout(res: Response) {
    res.clearCookie('token');
    return { message: 'Logged out' };
  }

  async googleLoginAndRegister(
    profile: { email: string; firstName: string; lastName: string; picture?: string },
    res: Response,
  ) {
    let user = await this.userRepository.findByEmail(profile.email);

    if (!user) {
      user = await this.userRepository.save({
        email: profile.email,
        first_name: profile.firstName,
        last_name: profile.lastName,
        created_at: new Date(),
        updated_at: new Date(),
        id: uuidv4(),
        password: '',
        is_verified: true,
        verification_token: null,
        listings: [],
        favorite_listings: [],
        interested_listings: [],
      });
    }

    const token = encrypt.generateToken({ id: user.id });
    this.setAuthCookie(res, token);

    res.redirect(
      `${process.env.FRONTEND_URL || 'http://localhost:3000'}/google-callback?token=${token}&user=${encodeURIComponent(JSON.stringify(user))}`,
    );
  }
}
