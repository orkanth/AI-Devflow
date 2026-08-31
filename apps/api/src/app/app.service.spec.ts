import { Test } from '@nestjs/testing';
import { AppService } from './app.service';
import { MemoryStore } from './store/memory.store';

describe('AppService', () => {
  let service: AppService;

  beforeAll(async () => {
    const app = await Test.createTestingModule({
      providers: [AppService, MemoryStore],
    }).compile();

    service = app.get<AppService>(AppService);
  });

  describe('getData', () => {
    it('should return the DevFlow health payload', () => {
      expect(service.getData().message).toEqual(
        'NestJS business API is online'
      );
    });
  });
});
