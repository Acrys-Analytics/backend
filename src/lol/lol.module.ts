import { Module } from '@nestjs/common';
import { LolService } from './lol.service';

@Module({
  providers: [LolService]
})
export class LolModule {}
