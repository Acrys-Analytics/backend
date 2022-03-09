import {
  Body,
  Controller,
  Get,
  MessageEvent,
  Param,
  Post,
  Sse,
} from '@nestjs/common';
import { CreateQueryDTO } from './dto/CreateQueryDTO';
import { Observable } from 'rxjs';

@Controller('query')
export class QueryController {
  @Post()
  createQuery(@Body() data: CreateQueryDTO) {}

  @Sse('/:id')
  getQuery(@Param('id') id: string): Observable<MessageEvent> {
    return;
  }
}
