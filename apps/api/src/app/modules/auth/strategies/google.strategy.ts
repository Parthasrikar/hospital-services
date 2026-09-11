import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface GoogleProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  picture?: string;
}

@Injectable()
export class GoogleAuthServiceStub {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Prepared helper for Google OAuth 2.0 Integration.
   * Will be connected to PassportGoogleStrategy once GOOGLE_CLIENT_ID is active.
   */
  getGoogleConfig() {
    return {
      clientID: this.configService.get<string>('GOOGLE_CLIENT_ID'),
      clientSecret: this.configService.get<string>('GOOGLE_CLIENT_SECRET'),
      callbackURL: this.configService.get<string>('GOOGLE_CALLBACK_URL'),
      scope: ['email', 'profile'],
    };
  }
}
