import { QueryType } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Regions } from 'twisted/dist/constants';

export class CreateQueryDTO {
  @IsNumber()
  @Min(1)
  @Max(100)
  depth: number;

  @IsEnum(QueryType)
  type: QueryType;

  @IsEnum(Regions)
  region: Regions;

  @IsString()
  @IsNotEmpty()
  search: string;
}
