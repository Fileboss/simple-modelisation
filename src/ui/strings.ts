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
		importFailed: 'Import failed:'
	},
	project: {
		backHome: 'All projects',
		notFound: 'This project does not exist, or it was deleted.',
		noDiagrams: 'No diagrams yet. Add a System design diagram or an MCD.',
		addSystem: '+ System design',
		addMcd: '+ MCD',
		deleteDiagram: 'Delete diagram',
		export: 'Export',
		undo: 'Undo',
		redo: 'Redo'
	},
	panel: {
		name: 'Name',
		label: 'Label'
	},
	system: {
		palette: 'Components',
		paletteHint: 'Drag onto the canvas. Drag from a dot on a component to connect it.',
		panelHint: 'Select a component or a connection to edit it.',
		skin: 'Skin',
		generic: 'Generic',
		connection: 'Connection'
	},
	mcd: {
		palette: 'MCD',
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
		legs: 'Legs'
	}
};
