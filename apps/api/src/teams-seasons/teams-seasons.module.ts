import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TeamsSeasonsController } from './teams-seasons.controller';
import { TeamsSeasonsService } from './teams-seasons.service';
@Module({ imports: [AuthModule], controllers: [TeamsSeasonsController], providers: [TeamsSeasonsService] })
export class TeamsSeasonsModule {}
