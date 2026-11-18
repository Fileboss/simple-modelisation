// Every UI string, in one place so a French translation can be added later.
export const strings = {
	appName: 'Simple Modelisation',
	loading: 'Loading…',
	home: {
		title: 'Projects',
		empty: 'No projects yet. Create one to start modeling.',
		newProject: 'New project',
		rename: 'Rename',
		delete: 'Delete',
		confirmDelete: 'Delete for good?',
		cancel: 'Cancel',
		updated: 'Updated',
		importProject: 'Import…',
		importFailed: 'Import failed:',
		shared: 'Shared',
		confirmRemove: 'Remove from my list? Others keep it.',
		remove: 'Remove'
	},
	project: {
		backHome: 'All projects',
		notFound: 'This project does not exist, or it was deleted.',
		noDiagrams: 'No diagrams yet. Add a System design diagram or an MCD.',
		addSystem: '+ System design',
		addMcd: '+ MCD',
		deleteDiagram: 'Delete diagram',
		export: 'Export',
		exportProject: 'Project (JSON)',
		exportImage: { png: 'Diagram as PNG', svg: 'Diagram as SVG' },
		nothingToExport: 'Nothing to export: open a Diagram with something in it',
		exportFailed: 'Image export failed',
		undo: 'Undo',
		redo: 'Redo',
		share: 'Share',
		copyLink: 'Copy link',
		linkCopied: 'Link copied',
		status: {
			local: 'Local',
			synced: 'Synced',
			offline: 'Offline',
			full: 'Too large: changes stay on this device'
		},
		copyFailed: 'Copy this link:'
	},
	sql: {
		tabs: { mld: 'MLD', sql: 'PostgreSQL' },
		expand: 'Show the MLD and SQL',
		collapse: 'Hide the MLD and SQL',
		copy: 'Copy',
		copied: 'Copied',
		copyFailed: 'Copy blocked: select the text',
		download: 'Download',
		warnings: 'warnings',
		empty: 'Add Entities to see the tables they make.'
	},
	hosting: {
		title: 'Hosting',
		unset: 'Not specified',
		clear: 'Click again to clear',
		names: {
			'bare-metal': 'Bare metal',
			vm: 'VM',
			docker: 'Docker',
			kubernetes: 'Kubernetes',
			managed: 'Managed (cloud)',
			serverless: 'Serverless',
			external: 'External service'
		}
	},
	provider: {
		title: 'Provider',
		unset: 'Not specified',
		names: {
			aws: 'AWS',
			'google-cloud': 'Google Cloud',
			azure: 'Azure',
			ovhcloud: 'OVHcloud',
			scaleway: 'Scaleway',
			hetzner: 'Hetzner',
			ionos: 'IONOS',
			'clever-cloud': 'Clever Cloud',
			digitalocean: 'DigitalOcean',
			vultr: 'Vultr',
			akamai: 'Akamai (Linode)',
			'alibaba-cloud': 'Alibaba Cloud',
			cloudflare: 'Cloudflare',
			vercel: 'Vercel',
			netlify: 'Netlify',
			fly: 'Fly.io',
			render: 'Render',
			railway: 'Railway'
		}
	},
	dataTypes: {
		label: 'Data type',
		length: 'Length',
		precision: 'Precision',
		scale: 'Scale',
		kinds: {
			integer: 'Integer',
			bigint: 'Big integer',
			decimal: 'Decimal',
			text: 'Text',
			varchar: 'Text(n)',
			boolean: 'Boolean',
			date: 'Date',
			datetime: 'Date time',
			uuid: 'UUID',
			serial: 'Auto-increment'
		}
	},
	presence: {
		you: 'you',
		renameHint: 'click to rename'
	},
	join: {
		joining: 'Opening the shared project…',
		notFound: 'This shared project does not exist.',
		unreachable: 'The server cannot be reached. Try again later.'
	},
	canvas: {
		tidyUp: 'Tidy up: arrange along the links'
	},
	panel: {
		name: 'Name',
		label: 'Label'
	},
	system: {
		palette: 'Components',
		paletteHint:
			'Drag onto the canvas. Drag from a dot on a component to connect it. A Zone groups what is drawn inside it: drag it by its title.',
		panelHint: 'Select a component, a connection or a zone to edit it.',
		zone: 'Zone',
		zoneHint:
			'A Zone holds the components and zones drawn wholly inside it, and moves them with it. Drag a component in or out to change that.',
		skin: 'Skin',
		generic: 'Generic',
		connection: 'Connection'
	},
	mcd: {
		palette: 'MCD',
		notation: 'Notation',
		notations: { merise: 'Merise', uml: 'UML' },
		entity: 'Entity',
		association: 'Association',
		leg: 'Leg',
		paletteHint:
			'Drag an Entity onto the canvas. Drag from a dot of an Entity to another Entity to create an Association, or to another dot of the same Entity for a reflexive one. Click a Cardinality to change it.',
		panelHint: 'Select an Entity, an Association or a Leg to edit it.',
		attributes: 'Attributes',
		identifier: 'Part of the Identifier',
		addAttribute: '+ Attribute',
		removeAttribute: 'Remove attribute',
		moveUp: 'Move up',
		moveDown: 'Move down',
		addReflexive: '+ Reflexive association',
		optional: 'Optional',
		optionalHint: 'The column accepts NULL',
		legs: 'Legs',
		multiplicities: 'Multiplicities',
		end: 'end'
	}
};
