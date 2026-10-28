import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from '@services/auth/auth.service';
import { LoginDto } from '@application/dto/auth/login.dto';
import { RegisterDto } from '@application/dto/auth/register.dto';
import { ForgotPasswordDto } from '@application/dto/auth/forgot-password.dto';
import { ResetPasswordDto } from '@application/dto/auth/reset-password.dto';
import { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { Cookies } from '@shared/cookie.helper';
import { Throttle } from '@nestjs/throttler';
import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';
import { PASSWORD_RULE } from '@application/dto/auth/register.dto';

class ChangePasswordDto {
  @IsNotEmpty()
  @IsString()
  currentPassword: string;

  @IsNotEmpty()
  @IsString()
  @Length(8, 72)
  @Matches(PASSWORD_RULE, { message: 'password too weak' })
  newPassword: string;
}

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('/login')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.login(body, res);
  }

  @Post('/signup')
  @Throttle({ default: { limit: 5, ttl: 60 * 60_000 } })
  async signup(
    @Body() body: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.signup(body, res);
  }

  @Get('/auth/verify-email')
  async verifyEmail(@Query('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  @Post('/change-password')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async changePassword(
    @Body() body: ChangePasswordDto,
    @Cookies('token') token: string,
  ) {
    return this.authService.changePassword(
      token,
      body.currentPassword,
      body.newPassword,
    );
  }

  @Post('/forgot-password')
  @Throttle({ default: { limit: 5, ttl: 60 * 60_000 } })
  async forgotPassword(@Body() body: ForgotPasswordDto) {
    return this.authService.forgotPassword(body);
  }

  @Get('/reset-password/check')
  @Throttle({ default: { limit: 30, ttl: 60 * 60_000 } })
  async checkResetToken(@Query('token') token: string) {
    return this.authService.checkResetToken(token);
  }

  @Post('/reset-password')
  @Throttle({ default: { limit: 10, ttl: 60 * 60_000 } })
  async resetPassword(@Body() body: ResetPasswordDto) {
    return this.authService.resetPassword(body);
  }

  @Post('/auth/resend-verification')
  @Throttle({ default: { limit: 3, ttl: 60 * 60_000 } })
  async resendVerification(@Cookies('token') token: string) {
    return this.authService.resendVerification(token);
  }

  @Post('/logout')
  async logout(@Res({ passthrough: true }) res: Response) {
    return this.authService.logout(res);
  }

  @Get('/google')
  @UseGuards(AuthGuard('google'))
  async googleLogin() {}

  @Get('/auth/google/callback')
  @UseGuards(AuthGuard('google'))
  async googleLoginCallback(
    @Req()
    req: {
      user: {
        email: string;
        firstName: string;
        lastName: string;
        picture: string;
      };
    },
    @Res() res: Response,
  ) {
    await this.authService.googleLoginAndRegister(req.user, res);
  }
}
