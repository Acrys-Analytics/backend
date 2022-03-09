import { QueryType } from '@prisma/client';
import { IsEnum, IsNumber, IsString } from 'class-validator';
import { Regions } from 'twisted/dist/constants';

export class CreateQueryDTO {
  @IsNumber()
  depth: number;

  @IsEnum(Regions)
  region: Regions;

  @IsEnum(QueryType)
  type: QueryType;

  @IsString()
  searchName: string;
}
