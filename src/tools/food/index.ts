/**
 * Bloque Food — barrel de 10 tools.
 */

import { restaurantDeepSearch, restaurantReviewAggregate, menuExtract } from "./restaurants";
import {
  recipeFind,
  recipeByIngredients,
  recipeSave,
  recipeShow,
  foodInfo,
  winePairing,
  nutritionCalc,
} from "./recipes";

export const foodTools = [
  restaurantDeepSearch,
  restaurantReviewAggregate,
  menuExtract,
  recipeFind,
  recipeByIngredients,
  recipeSave,
  recipeShow,
  foodInfo,
  winePairing,
  nutritionCalc,
];
