import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CreateQueryDTO } from './dto/CreateQueryDTO';

@Injectable()
export class QueryService {
  constructor(private prisma: PrismaClient) {}

  createAnalyticsQuery(config: CreateQueryDTO) {
    throw new Error("Can't find summoner.");
  }
}
