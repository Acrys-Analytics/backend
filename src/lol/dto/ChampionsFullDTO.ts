import { ChampionsDataDragon } from 'twisted/dist/models-dto';

export class ChampionsFullDTO extends ChampionsDataDragon {
  keys: { [id: number]: string };
}
