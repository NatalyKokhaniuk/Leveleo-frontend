export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  language?: string;
}

export interface ResendConfirmationRequest {
  email: string;
}

export interface AuthResponse {
  user: UserResponse | null;
  accessToken?: string;
  status?: 'SUCCESS' | '2FA_REQUIRED';
  method?: string;
  twoFaToken?: string | null;
}

export interface UserResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  language: string;
  avatarUrl?: string;
  phoneNumber?: string;
  roles: string[];
  twoFactorEnabled: boolean;
  twoFactorMethod?: 'Email' | 'Sms' | 'Totp' | null;
}

export interface RefreshResponse {
  user: UserResponse;
  accessToken: string;
}

export interface TwoFactorInitiateRequest {
  method: 'Email' | 'Sms' | 'Totp';
}

export interface TwoFactorInitiateResponse {
  method: 'Email' | 'Sms' | 'Totp';
  temporaryToken: string;
  totpSecret?: string;
}

export interface TwoFactorConfirmSetupRequest {
  code: string;
  temporaryToken: string;
}

export interface TwoFactorConfirmSetupResponse {
  success: boolean;
  message: string;
  method: string;
}

export interface TwoFactorVerifyRequest {
  twoFaToken: string;
  code: string;
}

export interface TwoFactorDisableResponse {
  success: boolean;
  message?: string;
}

export interface BackupCodesResponse {
  codes: string[];
}

export interface LoginWithBackupCodeRequest {
  email: string;
  backupCode: string;
}

export interface RequestPasswordResetRequest {
  email: string;
}

export interface ConfirmPasswordResetRequest {
  userId: string;
  token: string;
  newPassword: string;
}

export interface ChangePasswordRequest {
  newPassword: string;
}



// Social
export interface SocialLoginRequest {
  provider: 'google' | 'facebook';
  accessToken: string;
}

export interface TempTokenExchangeRequest {
  tempToken: string;
}

export interface SocialRedirectResponse {
  redirectUrl: string;
}
