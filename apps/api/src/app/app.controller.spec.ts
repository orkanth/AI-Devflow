import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MemoryStore } from './store/memory.store';

describe('AppController', () => {
  let app: TestingModule;

  beforeAll(async () => {
    app = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService, MemoryStore],
    }).compile();
  });

  describe('getData', () => {
    it('should describe the DevFlow API', () => {
      const appController = app.get<AppController>(AppController);
      const data = appController.getData();
      expect(data.name).toEqual('DevFlow AI');
      expect(data.stats.users).toBeGreaterThan(0);
    });
  });
});
