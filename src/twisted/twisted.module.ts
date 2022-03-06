import { DynamicModule, Logger, Module, Provider } from '@nestjs/common';
import { LolApi } from 'twisted';
import { LOL_API } from './constants';

@Module({})
export class TwistedModule {
  static forRoot(apiKey: string): DynamicModule {
    const lolApi = new LolApi({
      key: apiKey,
    });

    const twistedProvider: Provider = {
      provide: LOL_API,
      useValue: lolApi,
    };

    return {
      module: TwistedModule,
      providers: [twistedProvider],
      exports: [twistedProvider],
      global: true,
    };
  }
}
