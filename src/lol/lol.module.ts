import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { LolService } from './lol.service';

@Module({
  imports: [HttpModule],
  providers: [LolService],
  exports: [LolService],
})
export class LolModule {}
