import { DynamicModule, Global, Module, Provider } from '@nestjs/common';
import { LolApi } from 'twisted';
import { IBaseApiParams } from 'twisted/dist/base/base.utils';
import { LOL_API } from './constants';

@Global()
@Module({})
export class TwistedModule {
  static forRoot(config: IBaseApiParams): DynamicModule {
    const lolApi = new LolApi(config);

    const lolApiProvider: Provider = {
      provide: LOL_API,
      useValue: lolApi,
    };

    return {
      module: TwistedModule,
      providers: [lolApiProvider],
      exports: [lolApiProvider],
    };
  }
}
