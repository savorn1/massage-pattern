import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { LoginDto, RegisterDto } from './dto';
import { UserDocument } from '@/modules/shared/entities';
import { UserRole } from '@/common/constants/roles.constant';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Validate user credentials
   */
  async validateUser(
    email: string,
    password: string,
  ): Promise<UserDocument | null> {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      return null;
    }

    const isPasswordValid = await this.usersService.verifyPassword(
      user,
      password,
    );

    if (!isPasswordValid) {
      return null;
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    return user;
  }

  /**
   * Login user and return tokens
   */
  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.email, loginDto.password);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = await this.generateTokens(user);

    // Update last login - cast _id to string
    const userId = String(user._id);
    await this.usersService.updateUser(userId, {
      lastLogin: new Date(),
    } as Partial<UserDocument>);

    this.logger.log(`User logged in: ${user.email}`);

    return {
      success: true,
      message: 'Login successful',
      user: this.sanitizeUser(user),
      tokens,
    };
  }

  /**
   * Register a new user
   */
  async register(registerDto: RegisterDto) {
    // Convert RegisterDto to CreateUserDto format
    const createUserData = {
      email: registerDto.email,
      password: registerDto.password,
      name: registerDto.name,
      role: registerDto.role || UserRole.ADMIN,
    };

    const user = await this.usersService.createUser(createUserData);
    const tokens = await this.generateTokens(user);

    this.logger.log(`New user registered: ${user.email}`);

    return {
      success: true,
      message: 'Registration successful',
      user: this.sanitizeUser(user),
      tokens,
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });

      const user = await this.usersService.findById(payload.sub);

      if (!user || !user.isActive) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const tokens = await this.generateTokens(user);

      return {
        success: true,
        message: 'Token refreshed successfully',
        tokens,
      };
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  /**
   * Get current user profile
   */
  async getProfile(userId: string) {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      success: true,
      data: this.sanitizeUser(user),
    };
  }

  /**
   * Generate access and refresh tokens
   */
  private async generateTokens(user: UserDocument) {
    const userId = String(user._id);
    const payload: JwtPayload = {
      sub: userId,
      email: user.email,
      role: user.role,
    };

    const expiresInSeconds = this.getExpiresInSeconds();
    const refreshExpiresInSeconds = this.getRefreshExpiresInSeconds();

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('jwt.secret'),
        expiresIn: expiresInSeconds,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
        expiresIn: refreshExpiresInSeconds,
      }),
    ]);

    return {
      accessToken,
      refreshToken,
      expiresIn: expiresInSeconds,
    };
  }

  /**
   * Get expires in seconds from config
   */
  private getExpiresInSeconds(): number {
    const expiresIn = this.configService.get<string>('jwt.expiresIn') || '1d';
    return this.parseExpiresIn(expiresIn);
  }

  /**
   * Get refresh expires in seconds from config
   */
  private getRefreshExpiresInSeconds(): number {
    const expiresIn =
      this.configService.get<string>('jwt.refreshExpiresIn') || '7d';
    return this.parseExpiresIn(expiresIn);
  }

  /**
   * Parse expires in string to seconds
   */
  private parseExpiresIn(expiresIn: string): number {
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) return 86400; // Default 1 day

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 3600;
      case 'd':
        return value * 86400;
      default:
        return 86400;
    }
  }

  /**
   * Remove sensitive data from user object
   */
  private sanitizeUser(user: UserDocument) {
    const userId = String(user._id);
    return {
      id: userId,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      isEmailVerified: user.isEmailVerified,
      lastLogin: user.lastLogin,
      points: user.points ?? 0,
    };
  }
}
