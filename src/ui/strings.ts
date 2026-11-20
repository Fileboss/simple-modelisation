import { ENGLISH_NAMES } from '@simple-modelisation/model/names.ts';

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
		renameDiagram: 'Rename diagram',
		confirmDeleteDiagram: (name: string) => `Delete ${name}?`,
		diagrams: 'Diagrams',
		menu: 'Menu',
		rename: 'Rename',
		export: 'Export',
		exportProject: 'Project (JSON)',
		exportImage: { png: 'Diagram as PNG', svg: 'Diagram as SVG' },
		exportAll: 'All diagrams (SVG, .zip)',
		includeLegend: 'Include legend',
		mcdsLeftOut: (names: string) => `Not in the zip yet (MCDs): ${names}`,
		noSystemDiagram: 'No System design diagram to export',
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
			full: 'Too large: changes stay on this device',
			busy: 'Sharing unavailable, the server is busy: changes stay on this device for now',
			refused: 'Sharing refused by the server: changes stay on this device'
		},
		copyFailed: 'Copy this link:',
		stopSharing: 'Stop sharing',
		confirmStopSharing:
			'Stop sharing on this device? You keep a local copy; others keep the shared Project.',
		stopSharingFailed: 'Could not make the local copy'
	},
	menu: {
		properties: 'Properties',
		duplicate: 'Duplicate',
		copy: 'Copy',
		cut: 'Cut',
		delete: 'Delete',
		paste: 'Paste here',
		selectAll: 'Select all'
	},
	drawer: {
		palette: 'Add',
		panel: 'Properties',
		close: 'Close'
	},
	sql: {
		title: 'SQL',
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
		names: ENGLISH_NAMES.hostings
	},
	provider: {
		title: 'Provider',
		unset: 'Not specified',
		from: (zone: string) => `from ${zone}`,
		zoneHint: 'Taken by the components inside that have none of their own.',
		inherited: (zone: string, provider: string) => `From Zone ${zone}: ${provider}`,
		names: ENGLISH_NAMES.providers
	},
	flow: {
		title: 'Flow',
		unset: 'Not specified',
		hint: 'The arrow goes from who initiates; the Flow says what the data does.',
		names: ENGLISH_NAMES.flows
	},
	runtime: {
		title: 'Runtime',
		unset: 'Not specified',
		hint: 'What runs it on the server, or its language for a native binary.'
	},
	clipboard: {
		copyFailed: 'Copy failed: the browser refused the clipboard. Nothing was removed.',
		pasteFailed: 'Paste failed: the browser refused the clipboard. Try Edit > Paste.'
	},
	note: {
		title: 'Note',
		text: 'Text',
		empty: 'Double-click to write',
		color: 'Color',
		colors: {
			yellow: 'Yellow',
			pink: 'Pink',
			green: 'Green',
			blue: 'Blue',
			purple: 'Purple'
		}
	},
	choices: {
		showAll: (count: number) => `Show all (${count})`,
		showLess: 'Show less',
		search: 'Search',
		noMatch: 'Nothing matches.'
	},
	types: ENGLISH_NAMES.types,
	disk: {
		title: 'Kind',
		unset: 'Not specified',
		names: ENGLISH_NAMES.diskKinds
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
		notOpen:
			'Nobody has this project open right now: this server keeps nothing. Ask whoever shared it to open it, then try again.',
		busy: 'The server is busy: try again later.',
		unreachable: 'The server cannot be reached. Try again later.'
	},
	canvas: {
		tidyUp: 'Tidy up: arrange along the links',
		touchGestures:
			'Tap an item, then tap the canvas to place it. One finger pans, two fingers zoom. Drag from a dot to connect; press and hold an element for its actions.',
		tapToPlace: (label: string) => `Tap the canvas to place: ${label}`,
		cancel: 'Cancel',
		gestures:
			'Drag on the background to select, Shift+click to add, Cmd/Ctrl+A for all, Escape for none, Delete to remove; Cmd/Ctrl+C, X, V copy, cut and paste, Cmd/Ctrl+D duplicates. Pan with two fingers, a right-drag or Space+drag. Hold Alt while moving to place freely.'
	},
	panel: {
		name: 'Name',
		type: 'Type',
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
		role: 'Role',
		generic: 'Generic',
		skinGroups: { frameworks: 'Frameworks', products: 'Products' },
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
			'Drag an Entity onto the canvas. Drag from a dot of an Entity to another Entity to create an Association, or to another dot of the same Entity for a reflexive one. Drag between an Association and an Entity to add a Leg: three Legs or more make an N-ary Association. Click a Cardinality to change it.',
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
		relative: (entity: string) =>
			`Relative identifier (R): ${entity} is identified within the other`,
		inheritance: 'Inheritance',
		inheritsFrom: 'Inherits from',
		noParent: 'None',
		inheritanceHint:
			'The children share the parent’s Attributes and Identifier. Choose a child’s parent in its panel.',
		children: 'Children',
		constraint: 'Constraint',
		constraints: {
			none: 'None',
			X: 'X: at most one child',
			T: 'T: at least one child',
			XT: 'XT: exactly one child'
		},
		translation: 'In the MLD',
		translations: {
			reference: 'By reference: child tables reference the parent’s',
			down: 'Push down: no parent table',
			up: 'Push up: one parent table with a type column'
		},
		cif: 'CIF',
		addCif: '+ CIF',
		cifHint:
			'The Entities on the determinant Legs fix the one on the determined Leg: the MLD leaves it out of the key.',
		cifRoles: { determinant: 'Determinant', determined: 'Determined', none: 'Not involved' },
		multiplicities: 'Multiplicities',
		end: 'end'
	}
};
