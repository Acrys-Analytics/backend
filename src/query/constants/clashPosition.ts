import { Position } from '@prisma/client';

export const ClashPositionMapping = {
  UNSELECTED: Position.FILL,
  FILL: Position.FILL,
  TOP: Position.TOP,
  JUNGLE: Position.JUNGLE,
  MIDDLE: Position.MIDDLE,
  BOTTOM: Position.BOTTOM,
  UTILITY: Position.UTILITY,
};
