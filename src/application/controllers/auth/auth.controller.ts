import {
  Body,
  Controller,
  Get,
  Post,
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

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('/login')
  async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.login(body, res);
  }

  @Post('/signup')
  async signup(
    @Body() body: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.signup(body, res);
  }

  @Post('/forgot-password')
  async forgotPassword(@Body() body: ForgotPasswordDto) {
    return this.authService.forgotPassword(body);
  }

  @Post('/reset-password')
  async resetPassword(@Body() body: ResetPasswordDto) {
    return this.authService.resetPassword(body);
  }

  @Post('/logout')
  async logout(@Res({ passthrough: true }) res: Response) {
    return this.authService.logout(res);
  }

  @Get('/google')
  @UseGuards(AuthGuard('google'))
  async googleLogin() {
    // Passport handles the redirection to Google's login page
  }

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
