import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { Strategy, Profile, VerifyCallback } from 'passport-google-oauth20';

export interface GoogleProfileData {
  googleId: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  picture?: string;
  accessToken?: string;
  refreshToken?: string;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(configService: ConfigService) {
    const clientID = configService.get<string>('GOOGLE_CLIENT_ID') || 'dummy_client_id';
    const clientSecret = configService.get<string>('GOOGLE_CLIENT_SECRET') || 'dummy_client_secret';
    const callbackURL =
      configService.get<string>('GOOGLE_CALLBACK_URL') ||
      'http://localhost:3000/api/auth/google/callback';

    super({
      clientID,
      clientSecret,
      callbackURL,
      scope: ['email', 'profile'],
      passReqToCallback: true,
    });
  }

  async validate(
    _req: Request,
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<void> {
    const { id, name, emails, photos } = profile;

    const email = emails && emails.length > 0 ? emails[0].value : '';
    const firstName = name?.givenName || '';
    const lastName = name?.familyName || '';
    const fullName = `${firstName} ${lastName}`.trim() || email.split('@')[0];
    const picture = photos && photos.length > 0 ? photos[0].value : undefined;

    const userProfile: GoogleProfileData = {
      googleId: id,
      email: email.toLowerCase(),
      firstName,
      lastName,
      fullName,
      picture,
      accessToken,
      refreshToken,
    };

    done(null, userProfile);
  }
}
