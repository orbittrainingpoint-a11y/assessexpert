import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      // main.ts crashes the process if JWT_SECRET is missing or too
      // short, so by the time this module loads we know it's set.
      secret: process.env.JWT_SECRET,
      // NestJS 11's @nestjs/jwt tightened the expiresIn type to
      // jsonwebtoken's StringValue (template literal of `<n><unit>`).
      // process.env reads return string | undefined which doesn't
      // narrow to that template type, so we cast. Runtime behaviour
      // unchanged — jsonwebtoken accepts the same string format.
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN || '15m') as any },
    }),
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, LocalStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
