import { DynamicModule, Global, Module, Provider } from '@nestjs/common';
import { LolApi } from 'twisted';
import { LOLAPI } from './twisted.constants';

@Global()
@Module({})
export class TwistedModule {
  static forRoot(apiKey: string): DynamicModule {
    const lolApi = new LolApi(apiKey);

    const lolApiProvider: Provider = {
      provide: LOLAPI,
      useValue: lolApi,
    };

    return {
      module: TwistedModule,
      providers: [lolApiProvider],
      exports: [lolApiProvider],
    };
  }
}
