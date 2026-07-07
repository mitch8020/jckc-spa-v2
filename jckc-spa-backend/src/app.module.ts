import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { validate } from './config/env.validation';
import { configureMongoSrvDns } from './config/mongo-dns';
import { AuthModule } from './modules/auth/auth.module';
import { ClassroomsModule } from './modules/classrooms/classrooms.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { GuardiansModule } from './modules/guardians/guardians.module';
import { HealthModule } from './modules/health/health.module';
import { ReportsModule } from './modules/reports/reports.module';
import { StudentsModule } from './modules/students/students.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const uri = config.getOrThrow<string>('MONGO_URI');
        await configureMongoSrvDns(
          uri,
          config.get<string>('MONGO_DNS_SERVERS'),
        );
        return { uri };
      },
    }),
    AuthModule,
    UsersModule,
    StudentsModule,
    ClassroomsModule,
    GuardiansModule,
    ReportsModule,
    DashboardModule,
    HealthModule,
  ],
})
export class AppModule {}
