import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAccessGuard } from './guards/jwt-access.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { User } from '@prisma/client';
import { RedisRateLimitGuard } from '../redis/redis-rate-limit.guard';
import { RateLimit } from '../redis/rate-limit.decorator';
import { RATE_LIMIT_CONFIGS } from '../redis/redis.constants';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @UseGuards(RedisRateLimitGuard)
  @RateLimit(RATE_LIMIT_CONFIGS.AUTH_STRICT)
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ) {
    return this.authService.register(dto, res, req);
  }

  @Post('login')
  @UseGuards(RedisRateLimitGuard)
  @RateLimit(RATE_LIMIT_CONFIGS.AUTH_STRICT)
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ) {
    return this.authService.login(dto, res, req);
  }



  @Post('refresh')
  @UseGuards(JwtRefreshGuard)
  @HttpCode(HttpStatus.OK)
  async refresh(
    @CurrentUser() userSessionInfo: { userId: string; refreshToken: string },
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ) {
    return this.authService.refreshTokens(
      userSessionInfo.userId,
      userSessionInfo.refreshToken,
      res,
      req,
    );
  }

  @Post('logout')
  @UseGuards(JwtAccessGuard)
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser('id') userId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req?.cookies?.refresh_token;
    return this.authService.logout(userId, refreshToken, res);
  }

  @Get('me')
  @UseGuards(JwtAccessGuard)
  @HttpCode(HttpStatus.OK)
  async getProfile(@CurrentUser() user: User) {
    return {
      user,
    };
  }

  // Future Google OAuth Placeholders
  @Get('google')
  async googleAuth() {
    return {
      message: 'Google OAuth flow prepared. Configure GOOGLE_CLIENT_ID to enable redirect.',
    };
  }

  @Get('google/callback')
  async googleAuthCallback() {
    return {
      message: 'Google OAuth callback handler prepared.',
    };
  }
}
