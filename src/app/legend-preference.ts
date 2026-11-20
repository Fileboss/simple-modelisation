import { readFlag, saveFlag } from '../ui/preference';

// Exported images of System design diagrams carry a Legend unless it is turned off here.
const LEGEND_KEY = 'simple-modelisation:export-legend';

export const readIncludeLegend = () => readFlag(LEGEND_KEY);

export const saveIncludeLegend = (include: boolean) => saveFlag(LEGEND_KEY, include);
