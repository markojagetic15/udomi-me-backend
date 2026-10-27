import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
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
import { Response } from 'express';
import { MailService, frontendUrl } from '@shared/mail.service';
import { emailCopy } from '@services/notification/email-copy';
import { UserService } from '@services/user/user.service';

const RESET_TTL_MS = 60 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly authRepository: AuthRepository,
    private readonly userService: UserService,
    private readonly mail: MailService,
  ) {}

  private setAuthCookie(res: Response, token: string) {
    res.cookie('token', token, {
      httpOnly: true,
      // req.secure (not NODE_ENV) so login still works over plain HTTP before
      // TLS is set up — browsers drop Secure cookies on http://. Relies on
      // `trust proxy` in main.ts + nginx's X-Forwarded-Proto.
      secure: res.req.secure,
      // 'lax' (not 'strict'): the cookie must survive top-level navigations
      // from other sites — the Google OAuth redirect and links in emails.
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  private lang(user: Pick<User, 'language'>) {
    return user.language === 'en' ? 'en' : 'hr';
  }

  private sendVerification(user: User) {
    return this.mail.send(
      { email: user.email, name: `${user.first_name} ${user.last_name}` },
      emailCopy.verify(this.lang(user), {
        name: user.first_name,
        token: user.verification_token!,
      }),
      this.lang(user),
    );
  }

  async login(body: LoginDto, res: Response) {
    const user = await this.userRepository.findByEmail(body.email);

    // Same message for unknown email and wrong password — don't reveal which
    // addresses have accounts.
    const invalid = new UnauthorizedException('INVALID_CREDENTIALS');
    if (!user) throw invalid;
    if (!user.password) throw new UnauthorizedException('GOOGLE_ACCOUNT');
    if (!(await encrypt.comparepassword(user.password, body.password)))
      throw invalid;
    if (user.is_banned) throw new ForbiddenException('ACCOUNT_BANNED');

    this.setAuthCookie(res, encrypt.generateToken({ id: user.id }));
    return user;
  }

  async signup(body: RegisterDto, res: Response) {
    const { first_name, last_name, email, password } = body;

    const existingUser = await this.userRepository.findByEmail(email);
    if (existingUser) {
      throw new ConflictException(
        existingUser.password ? 'EMAIL_TAKEN' : 'GOOGLE_ACCOUNT',
      );
    }

    const user = new User();
    user.id = uuidv4();
    user.first_name = first_name.trim();
    user.last_name = last_name.trim();
    user.email = email.trim().toLowerCase();
    user.password = await encrypt.encryptpass(password);
    user.is_verified = false;
    user.verification_token = uuidv4();
    user.language = body.language ?? 'hr';

    await this.userRepository.save(user);
    await this.sendVerification(user);

    this.setAuthCookie(res, encrypt.generateToken({ id: user.id }));
    return user;
  }

  async resendVerification(token: string) {
    const me = await this.userService.getMe(token, []);
    if (me.is_verified) return { message: 'Already verified' };
    if (!this.mail.isConfigured()) {
      throw new HttpException(
        'EMAIL_NOT_CONFIGURED',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    me.verification_token = uuidv4();
    await this.userRepository.save(me);
    await this.sendVerification(me);
    return { message: 'Verification email sent' };
  }

  async verifyEmail(token: string) {
    const user = await this.userRepository.findByVerificationToken(token);
    if (!user) {
      throw new BadRequestException('INVALID_VERIFICATION_LINK');
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
    const user = await this.userService.getMe(authToken, []);

    if (!user.password) {
      throw new BadRequestException('GOOGLE_ACCOUNT');
    }
    if (!(await encrypt.comparepassword(user.password, currentPassword))) {
      throw new UnauthorizedException('WRONG_PASSWORD');
    }

    user.password = await encrypt.encryptpass(newPassword);
    await this.userRepository.save(user);
    return { message: 'Password changed successfully' };
  }

  async forgotPassword(body: ForgotPasswordDto) {
    const generic = {
      message: 'If that email exists, a reset link has been sent.',
    };
    const user = await this.userRepository.findByEmail(body.email);
    // Google-only accounts get the same generic answer (no account enumeration).
    if (!user || !user.password || user.is_banned) return generic;

    const token = {
      token: uuidv4(),
      userId: user.id,
      expiration: new Date(Date.now() + RESET_TTL_MS),
    };
    await this.authRepository.save(token);
    await this.mail.send(
      { email: user.email, name: `${user.first_name} ${user.last_name}` },
      emailCopy.reset(this.lang(user), { token: token.token }),
      this.lang(user),
    );
    return generic;
  }

  async resetPassword(body: ResetPasswordDto) {
    const tokenData = await this.authRepository.findByToken(body.token);
    if (!tokenData || tokenData.expiration < new Date()) {
      throw new BadRequestException('INVALID_RESET_LINK');
    }

    const user = await this.userRepository.findById(tokenData.userId);
    if (!user) throw new BadRequestException('INVALID_RESET_LINK');

    user.password = await encrypt.encryptpass(body.password);
    // Resetting via email proves ownership of the address.
    user.is_verified = true;
    await this.userRepository.save(user);
    await this.authRepository.deleteForUser(user.id);
    return { message: 'Password reset successfully' };
  }

  async logout(res: Response) {
    res.clearCookie('token', {
      httpOnly: true,
      sameSite: 'lax',
      secure: res.req.secure,
    });
    return { message: 'Logged out' };
  }

  async googleLoginAndRegister(
    profile: {
      email: string;
      firstName: string;
      lastName: string;
      picture?: string;
    },
    res: Response,
  ) {
    let user = await this.userRepository.findByEmail(profile.email);

    if (user?.is_banned) {
      return res.redirect(`${frontendUrl()}/login?error=banned`);
    }

    if (!user) {
      const created = new User();
      created.id = uuidv4();
      created.email = profile.email.toLowerCase();
      created.first_name = profile.firstName || profile.email.split('@')[0];
      created.last_name = profile.lastName || '';
      created.password = '';
      created.is_verified = true;
      created.verification_token = null;
      user = await this.userRepository.save(created);
    } else if (!user.is_verified) {
      // Google has verified the address.
      user.is_verified = true;
      user.verification_token = null;
      await this.userRepository.save(user);
    }

    this.setAuthCookie(res, encrypt.generateToken({ id: user.id }));
    // The cookie carries the session; nothing sensitive goes in the URL.
    res.redirect(`${frontendUrl()}/google-callback`);
  }
}
