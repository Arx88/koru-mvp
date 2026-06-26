/**
 * Bloque Money — 15 tools.
 * barrel que reúne todas las tools del bloque.
 */

import { currencyConvert } from "./currencyConvert";
import { exchangeHistory } from "./exchangeHistory";
import { cryptoPrice } from "./cryptoPrice";
import { stockQuote } from "./stockQuote";
import {
  expenseTrack,
  expenseSummary,
  expenseAlert,
  budgetSet,
  subscriptionReminder,
  taxEstimate,
  inflationData,
  priceCompareProduct,
} from "./expenses";
import {
  priceHistory,
  productReview,
  budgetCheck,
  expenseByCategory,
} from "./advanced";

export const moneyTools = [
  currencyConvert,
  exchangeHistory,
  cryptoPrice,
  stockQuote,
  expenseTrack,
  expenseSummary,
  expenseAlert,
  budgetSet,
  subscriptionReminder,
  taxEstimate,
  inflationData,
  priceCompareProduct,
  priceHistory,
  productReview,
  budgetCheck,
  expenseByCategory,
];
