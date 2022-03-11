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
import { QueryService } from './query.service';

@Controller('query')
export class QueryController {
  constructor(private queryService: QueryService) {}

  @Post()
  createQuery(@Body() data: CreateQueryDTO) {
    return this.queryService.createAnalyticsQuery(data);
  }

  @Sse('/:id')
  getQuery(@Param('id') id: string): Observable<MessageEvent> {
    return this.queryService.getAnalyticsQuery(id);
  }
}
