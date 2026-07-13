import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  status() {
    return {
      name: 'LoopTodo API',
      status: 'ok',
      documentation: 'Use the authenticated application endpoints to access LoopTodo data.',
    };
  }
}
