import { Module } from '@nestjs/common';

import { PrismaScoringRepository } from './prisma-scoring.repository';
import { ScoringController } from './scoring.controller';
import { SCORING_REPOSITORY } from './scoring.repository';
import { ScoringService } from './scoring.service';

@Module({
  controllers: [ScoringController],
  providers: [ScoringService, { provide: SCORING_REPOSITORY, useClass: PrismaScoringRepository }],
  exports: [ScoringService],
})
export class ScoringModule {}
