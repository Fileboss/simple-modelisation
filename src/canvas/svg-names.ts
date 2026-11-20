import type { SvgNames } from '@simple-modelisation/model/svg/system.ts';
import { strings } from '../ui/strings';

/** The names images print, from the UI strings. */
export const SVG_NAMES: SvgNames = {
	types: strings.types,
	diskKinds: strings.disk.names,
	hostings: strings.hosting.names,
	providers: strings.provider.names,
	flows: strings.flow.names,
	dataTypes: strings.dataTypes.kinds,
	titles: {
		flow: strings.flow.title,
		hosting: strings.hosting.title,
		provider: strings.provider.title,
		runtime: strings.runtime.title
	}
};
