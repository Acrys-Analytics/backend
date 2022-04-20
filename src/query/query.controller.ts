import {
  Body,
  Controller,
  Get,
  MessageEvent,
  Param,
  Post,
  Sse,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { CreateQueryDTO } from './dto/CreateQueryDTO';
import { QueryCreatedDTO } from './dto/QueryCreatedDTO';
import { QueryService } from './query.service';

@Controller('query')
export class QueryController {
  constructor(private queryService: QueryService) {}

  @Post()
  async createQuery(@Body() data: CreateQueryDTO): Promise<QueryCreatedDTO> {
    const queryId = await this.queryService.createQuery(data);

    return { queryId };
  }

  @Get('/:id')
  async retrieveQueryOnce(@Param('id') id: string) {
    return await this.queryService.getAnalyzedQuery(id);
  }

  @Sse('/:id/sse')
  retrieveQuery(@Param('id') id: string): Observable<MessageEvent> {
    return this.queryService.retrieveQuery(id);
  }
}
