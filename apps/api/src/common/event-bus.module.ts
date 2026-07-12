import { Global, Module } from '@nestjs/common';
import { EventEmitter } from 'node:events';

export class EventBusService {
  private readonly emitter = new EventEmitter();
  emit(event: 'score.settled', userId: string) { this.emitter.emit(event, userId); }
  on(event: 'score.settled', listener: (userId: string) => void) { this.emitter.on(event, listener); }
  off(event: 'score.settled', listener: (userId: string) => void) { this.emitter.off(event, listener); }
}

@Global()
@Module({ providers: [EventBusService], exports: [EventBusService] })
export class EventBusModule {}
