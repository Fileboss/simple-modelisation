import { useCanvas } from '../canvas/canvas-context';
import type { Selection } from '../canvas/DiagramCanvas';
import { PanelField } from '../canvas/PanelField';
import {
	CARDINALITIES,
	type AssociationNode,
	type Cardinality,
	type CifNode,
	type CifRole,
	INHERITANCE_CONSTRAINTS,
	INHERITANCE_TRANSLATIONS,
	type InheritanceConstraint,
	type InheritanceNode,
	type InheritanceTranslation,
	type EntityNode,
	type LegEdge
} from '@simple-modelisation/model/project.ts';
import {
	DATA_TYPE_KINDS,
	dataType,
	isDataType,
	type DataType,
	type DataTypeKind
} from '@simple-modelisation/model/data-types.ts';
import { strings } from '../ui/strings';
import { umlMultiplicity, useNotation } from './notation';

export function McdPanel({ selection }: { selection: Selection }) {
	const { project, diagramId } = useCanvas();
	const isUml = useNotation(diagramId) === 'uml';
	const node = selection.node;

	if (node?.type === 'entity' || node?.type === 'association') {
		const element = node as EntityNode | AssociationNode;
		const isEntity = element.type === 'entity';
		return (
			<>
				<h2>{isEntity ? strings.mcd.entity : strings.mcd.association}</h2>
				<PanelField
					label={strings.panel.name}
					value={element.name}
					onChange={(name) => project.renameNode(diagramId, element.id, name)}
				/>
				<AttributesEditor element={element} />
				{isEntity && <ParentPicker entityId={element.id} />}
				{isEntity ? (
					<button
						className="panel-action"
						onClick={() => {
							project.stopCapturing();
							project.addAssociation(diagramId, element.id, element.id);
						}}
					>
						{strings.mcd.addReflexive}
					</button>
				) : (
					<>
						<LegsEditor associationId={element.id} isUml={isUml} />
						<AddCif associationId={element.id} />
					</>
				)}
			</>
		);
	}

	if (node?.type === 'cif') return <CifEditor cif={node as CifNode} />;
	if (node?.type === 'inheritance')
		return <InheritanceEditor inheritance={node as InheritanceNode} />;

	if (selection.edge?.type === 'leg') {
		const leg = selection.edge as LegEdge;
		// In UML a Leg's label shows the other Leg: list both ends, as drawn.
		if (isUml) {
			return (
				<>
					<h2>{strings.mcd.association}</h2>
					<LegsEditor associationId={leg.source} isUml />
				</>
			);
		}
		return (
			<>
				<h2>{strings.mcd.leg}</h2>
				<LegRow leg={leg} />
			</>
		);
	}

	return <p className="panel-hint">{strings.mcd.panelHint}</p>;
}

function AttributesEditor({ element }: { element: EntityNode | AssociationNode }) {
	const { project, diagramId } = useCanvas();
	const isEntity = element.type === 'entity';
	const last = element.attributes.length - 1;
	return (
		<>
			<h3>{strings.mcd.attributes}</h3>
			<ul className="attribute-editor">
				{element.attributes.map((attribute, index) => (
					<li key={attribute.id}>
						<div className="attribute-row">
							<PanelField
								value={attribute.name}
								onChange={(name) =>
									project.renameAttribute(diagramId, element.id, attribute.id, name)
								}
							/>
							<button
								disabled={index === 0}
								aria-label={strings.mcd.moveUp}
								onClick={() => project.moveAttribute(diagramId, element.id, attribute.id, -1)}
							>
								↑
							</button>
							<button
								disabled={index === last}
								aria-label={strings.mcd.moveDown}
								onClick={() => project.moveAttribute(diagramId, element.id, attribute.id, 1)}
							>
								↓
							</button>
							<button
								aria-label={strings.mcd.removeAttribute}
								onClick={() => project.removeAttribute(diagramId, element.id, attribute.id)}
							>
								×
							</button>
						</div>
						<div className="attribute-row attribute-details">
							<DataTypeField
								type={attribute.type ?? dataType('text')}
								onChange={(type) =>
									project.setAttributeType(diagramId, element.id, attribute.id, type)
								}
							/>
							{isEntity && (
								<label title={strings.mcd.identifier}>
									<input
										type="checkbox"
										checked={attribute.identifier}
										onChange={() => project.toggleIdentifier(diagramId, element.id, attribute.id)}
									/>
									ID
								</label>
							)}
							<label title={strings.mcd.optionalHint}>
								<input
									type="checkbox"
									checked={attribute.optional ?? false}
									disabled={attribute.identifier}
									onChange={(e) =>
										project.setAttributeOptional(
											diagramId,
											element.id,
											attribute.id,
											e.currentTarget.checked
										)
									}
								/>
								{strings.mcd.optional}
							</label>
						</div>
					</li>
				))}
			</ul>
			<button
				className="panel-action"
				onClick={() => {
					project.stopCapturing();
					project.addAttribute(diagramId, element.id);
				}}
			>
				{strings.mcd.addAttribute}
			</button>
		</>
	);
}

/** A Data type picker, with the parameters of Decimal(p,s) and Text(n). */
function DataTypeField({ type, onChange }: { type: DataType; onChange: (type: DataType) => void }) {
	const number = (value: number, label: string, change: (value: number) => DataType) => (
		<input
			key={`${label}-${value}`}
			className="type-parameter"
			type="number"
			min={label === strings.dataTypes.scale ? 0 : 1}
			aria-label={label}
			title={label}
			defaultValue={value}
			onBlur={(e) => {
				const next = change(Number(e.currentTarget.value));
				// An invalid value (empty, scale above precision…) puts the current one back.
				if (!isDataType(next)) e.currentTarget.value = String(value);
				else if (Number(e.currentTarget.value) !== value) onChange(next);
			}}
			onKeyDown={(e) => {
				if (e.key === 'Enter') e.currentTarget.blur();
			}}
		/>
	);
	return (
		<span className="data-type">
			<select
				aria-label={strings.dataTypes.label}
				value={type.kind}
				onChange={(e) => onChange(dataType(e.currentTarget.value as DataTypeKind))}
			>
				{DATA_TYPE_KINDS.map((kind) => (
					<option key={kind} value={kind}>
						{strings.dataTypes.kinds[kind]}
					</option>
				))}
			</select>
			{type.kind === 'varchar' &&
				number(type.length, strings.dataTypes.length, (length) => ({ ...type, length }))}
			{type.kind === 'decimal' && (
				<>
					{number(type.precision, strings.dataTypes.precision, (precision) => ({
						...type,
						precision
					}))}
					{number(type.scale, strings.dataTypes.scale, (scale) => ({ ...type, scale }))}
				</>
			)}
		</span>
	);
}

/** An Entity's parent: any other Entity but its own descendants. */
function ParentPicker({ entityId }: { entityId: string }) {
	const { project, diagramId } = useCanvas();
	const entities = project.nodes(diagramId).filter((n) => n.type === 'entity');
	const excluded = project.selfAndDescendants(diagramId, entityId);
	return (
		<label className="panel-field">
			{strings.mcd.inheritsFrom}
			<select
				value={project.parentOf(diagramId, entityId) ?? ''}
				onChange={(e) => {
					project.stopCapturing();
					try {
						project.setParent(diagramId, entityId, e.currentTarget.value || null);
					} catch (error) {
						// A peer made it a descendant meanwhile: the list redraws without it.
						console.warn('Parent refused', error);
					}
				}}
			>
				<option value="">{strings.mcd.noParent}</option>
				{entities
					.filter((e) => !excluded.has(e.id))
					.map((e) => (
						<option key={e.id} value={e.id}>
							{String(e.name)}
						</option>
					))}
			</select>
		</label>
	);
}

/** An Inheritance: its children, its constraint and its MLD translation. */
function InheritanceEditor({ inheritance }: { inheritance: InheritanceNode }) {
	const { project, diagramId } = useCanvas();
	const names = new Map(project.nodes(diagramId).map((n) => [n.id, String(n.name ?? '')]));
	const children = project
		.edges(diagramId)
		.filter((e) => e.type === 'isa' && e.source === inheritance.id)
		.map((e) => names.get(e.target));
	return (
		<>
			<h2>{strings.mcd.inheritance}</h2>
			<p className="panel-hint">{strings.mcd.inheritanceHint}</p>
			<p className="panel-field">
				{names.get(inheritance.parent)} → {children.join(', ')}
			</p>
			<label className="panel-field">
				{strings.mcd.constraint}
				<select
					value={inheritance.constraint ?? 'none'}
					onChange={(e) => {
						project.stopCapturing();
						project.setInheritanceConstraint(
							diagramId,
							inheritance.id,
							e.currentTarget.value as InheritanceConstraint
						);
					}}
				>
					{INHERITANCE_CONSTRAINTS.map((c) => (
						<option key={c} value={c}>
							{strings.mcd.constraints[c]}
						</option>
					))}
				</select>
			</label>
			<label className="panel-field">
				{strings.mcd.translation}
				<select
					value={inheritance.translation ?? 'reference'}
					onChange={(e) => {
						project.stopCapturing();
						project.setInheritanceTranslation(
							diagramId,
							inheritance.id,
							e.currentTarget.value as InheritanceTranslation
						);
					}}
				>
					{INHERITANCE_TRANSLATIONS.map((t) => (
						<option key={t} value={t}>
							{strings.mcd.translations[t]}
						</option>
					))}
				</select>
			</label>
		</>
	);
}

/** On an N-ary Association: puts a CIF above it. */
function AddCif({ associationId }: { associationId: string }) {
	const { project, diagramId } = useCanvas();
	const legs = project.edges(diagramId).filter((e) => e.source === associationId);
	if (legs.length < 3) return null;
	return (
		<button
			className="panel-action"
			onClick={() => {
				project.stopCapturing();
				project.addCif(diagramId, associationId);
			}}
		>
			{strings.mcd.addCif}
		</button>
	);
}

/** A CIF: each Leg of its Association as a determinant, the determined one, or not involved. */
function CifEditor({ cif }: { cif: CifNode }) {
	const { project, diagramId } = useCanvas();
	const legs = project
		.edges(diagramId)
		.filter((e): e is LegEdge => e.type === 'leg' && e.source === cif.association);
	const names = new Map(project.nodes(diagramId).map((n) => [n.id, String(n.name ?? '')]));
	const roleOf = (leg: string): CifRole =>
		leg === cif.determined ? 'determined' : cif.determinants.includes(leg) ? 'determinant' : 'none';
	return (
		<>
			<h2>{strings.mcd.cif}</h2>
			<p className="panel-hint">{strings.mcd.cifHint}</p>
			{legs.map((leg) => (
				<label key={leg.id} className="panel-field leg-row">
					<span>{names.get(leg.target)}</span>
					<select
						value={roleOf(leg.id)}
						onChange={(e) => {
							project.stopCapturing();
							project.setCifRole(diagramId, cif.id, leg.id, e.currentTarget.value as CifRole);
						}}
					>
						{(['determinant', 'determined', 'none'] as const).map((role) => (
							// The determined Leg changes by choosing another one; the last determinant stays.
							<option
								key={role}
								value={role}
								disabled={
									role !== roleOf(leg.id) &&
									(roleOf(leg.id) === 'determined' ||
										(role === 'none' &&
											cif.determinants.length === 1 &&
											roleOf(leg.id) === 'determinant'))
								}
							>
								{strings.mcd.cifRoles[role]}
							</option>
						))}
					</select>
				</label>
			))}
		</>
	);
}

function LegsEditor({ associationId, isUml }: { associationId: string; isUml: boolean }) {
	const { project, diagramId } = useCanvas();
	const legs = project
		.edges(diagramId)
		.filter((e): e is LegEdge => e.type === 'leg' && e.source === associationId);
	return (
		<>
			<h3>{isUml ? strings.mcd.multiplicities : strings.mcd.legs}</h3>
			{legs.map((leg) => {
				// In UML a Leg's Cardinality shows next to the other class.
				const peer = legs.find((other) => other.id !== leg.id);
				return (
					<LegRow
						key={leg.id}
						leg={leg}
						nextTo={isUml && legs.length === 2 ? peer?.target : undefined}
					/>
				);
			})}
		</>
	);
}

/** One Leg's Cardinality; in UML, as the multiplicity shown next to `nextTo`'s class. */
function LegRow({ leg, nextTo }: { leg: LegEdge; nextTo?: string }) {
	const { project, diagramId } = useCanvas();
	const nameOf = (id: string) =>
		String(project.nodes(diagramId).find((n) => n.id === id)?.name ?? '');
	return (
		<label className="panel-field leg-row">
			<span>
				{nextTo === undefined ? nameOf(leg.target) : `${nameOf(nextTo)} ${strings.mcd.end}`}
			</span>
			<select
				value={leg.cardinality}
				onChange={(e) =>
					project.setCardinality(diagramId, leg.id, e.currentTarget.value as Cardinality)
				}
			>
				{CARDINALITIES.map((c) => (
					<option key={c} value={c}>
						{nextTo === undefined ? c : umlMultiplicity(c)}
					</option>
				))}
			</select>
		</label>
	);
}
