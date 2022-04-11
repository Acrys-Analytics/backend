import { HttpModule } from '@nestjs/axios';
import { CacheModule, Module } from '@nestjs/common';
import { LolService } from './lol.service';

@Module({
  imports: [HttpModule, CacheModule.register()],
  providers: [LolService],
  exports: [LolService],
})
export class LolModule {}
