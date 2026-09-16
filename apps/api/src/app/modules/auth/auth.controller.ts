import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleTokenDto } from './dto/google-auth.dto';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto';
import { JwtAccessGuard } from './guards/jwt-access.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { User } from '@prisma/client';
import { RedisRateLimitGuard } from '../redis/redis-rate-limit.guard';
import { RateLimit } from '../redis/rate-limit.decorator';
import { RATE_LIMIT_CONFIGS } from '../redis/redis.constants';
import { GoogleProfileData } from './strategies/google.strategy';

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

  /**
   * Initiates Google Passport OAuth 2.0 redirect flow
   */
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  async googleAuth() {
    // Passport automatically redirects user to Google login consent screen
  }

  /**
   * Passport Google OAuth 2.0 callback endpoint
   */
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleAuthCallback(
    @Req() req: Request & { user: GoogleProfileData },
    @Res() res: Response,
  ) {
    const result = await this.authService.validateGoogleUser(req.user, res, req);
    
    // Redirect user back to frontend client dashboard or onboarding page
    const frontendUrl = process.env['FRONTEND_URL'] || 'http://localhost:4200';
    const redirectPath = result.isProfileComplete ? '/dashboard' : '/auth/onboarding';
    
    return res.redirect(`${frontendUrl}${redirectPath}`);
  }

  /**
   * Direct Google ID Token validation endpoint (Google Identity Services GIS button)
   */
  @Post('google/token')
  @UseGuards(RedisRateLimitGuard)
  @RateLimit(RATE_LIMIT_CONFIGS.AUTH_STRICT)
  @HttpCode(HttpStatus.OK)
  async googleTokenAuth(
    @Body() dto: GoogleTokenDto,
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ) {
    return this.authService.verifyGoogleIdToken(dto.idToken, res, req, dto.role);
  }

  /**
   * Progressive Profile Onboarding endpoint
   */
  @Patch('progressive-onboarding')
  @UseGuards(JwtAccessGuard)
  @HttpCode(HttpStatus.OK)
  async completeOnboarding(
    @CurrentUser('id') userId: string,
    @Body() dto: CompleteOnboardingDto,
  ) {
    return this.authService.completeProgressiveOnboarding(userId, dto);
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
}
