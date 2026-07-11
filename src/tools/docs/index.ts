/**
 * Bloque Docs/Productividad — barrel de ~36 tools.
 */

import { docCreateMd, docCreatePdf, docCreateWord, docCreateExcel, ocrText, dataAnalyze, dataChart } from "./documents";
import {
  noteWrite, noteShow, noteSearch,
  projectCreate, projectAdd, projectShow,
  taskCreate, taskList, taskDone,
  calendarAdd, calendarShow, calendarExportIcs,
  countdown, reminderSet, alarmSet,
} from "./tasks";
import {
  summarizeUrl, summarizeText, translate, lyricsFind, deepResearch,
  extractActionItems, emailDraft, messageDraft,
  copyToClipboard, qrGenerate,
  sunriseSunset, moonPhase, holidays, timeZone,
} from "./productivity";

export const docsTools = [
  // Documents (7)
  docCreateMd, docCreatePdf, docCreateWord, docCreateExcel,
  ocrText, dataAnalyze, dataChart,
  // Notes & Projects (6)
  noteWrite, noteShow, noteSearch,
  projectCreate, projectAdd, projectShow,
  // Tasks & Calendar (9)
  taskCreate, taskList, taskDone,
  calendarAdd, calendarShow, calendarExportIcs,
  countdown, reminderSet, alarmSet,
  // Productivity (14)
  summarizeUrl, summarizeText, translate, lyricsFind, deepResearch,
  extractActionItems, emailDraft, messageDraft,
  copyToClipboard, qrGenerate,
  sunriseSunset, moonPhase, holidays, timeZone,
];
