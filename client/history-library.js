import {HISTORY_CHAPTERS,HISTORY_LESSONS} from '/shared/history-lessons.js';
import {createReadingLibrary} from './culture-library.js';
export function createHistoryLibrary(options){return createReadingLibrary({...options,stories:HISTORY_LESSONS,chapters:HISTORY_CHAPTERS,namespace:'history',titleText:'별 역사 발전소'});}
