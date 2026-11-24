import { useState } from 'react';
import { useCanvas } from '../canvas/canvas-context';
import type { Selection } from '../canvas/DiagramCanvas';
import { PanelField } from '../canvas/PanelField';
import {
	CARDINALITIES,
	canBeRelative,
	type AssociationNode,
	type Attribute,
	type Cardinality,
	type CifNode,
	type CifRole,
	INHERITANCE_CONSTRAINTS,
	INHERITANCE_TRANSLATIONS,
	type InheritanceConstraint,
	type InheritanceNode,
	type InheritanceTranslation,
	type IsaEdge,
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
import { ConstraintError, MAX_COMMENT } from '@simple-modelisation/model/sql/constraints.ts';
import { foreignKeyOf } from '@simple-modelisation/model/sql/mld.ts';
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
				<CommentField
					key={`comment-${element.id}`}
					value={element.comment ?? ''}
					onChange={(comment) => project.setComment(diagramId, element.id, comment)}
				/>
				<AttributesEditor element={element} />
				{isEntity && <UniqueGroups key={element.id} entity={element} />}
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
							<label title={strings.mcd.uniqueHint}>
								<input
									type="checkbox"
									checked={attribute.unique ?? false}
									onChange={(e) =>
										project.setAttributeUnique(
											diagramId,
											element.id,
											attribute.id,
											e.currentTarget.checked
										)
									}
								/>
								{strings.mcd.unique}
							</label>
						</div>
						<AttributeSql elementId={element.id} attribute={attribute} />
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

/** An Attribute's Check and Comment, folded away until used. */
function AttributeSql({ elementId, attribute }: { elementId: string; attribute: Attribute }) {
	const { project, diagramId } = useCanvas();
	const isUsed = Boolean(attribute.check || attribute.comment);
	const [isOpen, setOpen] = useState(isUsed);
	return (
		<details open={isOpen} onToggle={(e) => setOpen(e.currentTarget.open)}>
			<summary>
				{strings.mcd.checkAndComment}
				{isUsed && ' •'}
			</summary>
			<CheckedField
				label={strings.mcd.check}
				value={attribute.check ?? ''}
				placeholder={strings.mcd.checkPlaceholder}
				onChange={(check) => project.setAttributeCheck(diagramId, elementId, attribute.id, check)}
			/>
			<CommentField
				value={attribute.comment ?? ''}
				onChange={(comment) =>
					project.setAttributeComment(diagramId, elementId, attribute.id, comment)
				}
			/>
		</details>
	);
}

/** A text field whose change may be refused: the text stays, with the reason under it. */
function CheckedField(props: CheckedFieldProps) {
	// Changed elsewhere (a peer, an undo): the refused text and its reason go.
	return <CheckedInput key={props.value} {...props} />;
}

type CheckedFieldProps = {
	label: string;
	value: string;
	placeholder: string;
	/** Throws why it refuses. */
	onChange: (value: string) => void;
};

function CheckedInput({ label, value, placeholder, onChange }: CheckedFieldProps) {
	const [problem, setProblem] = useState<string | null>(null);
	return (
		<label className="panel-field">
			<span>{label}</span>
			<input
				defaultValue={value}
				placeholder={placeholder}
				aria-invalid={problem !== null}
				onBlur={(e) => {
					const next = e.currentTarget.value.trim();
					try {
						if (next !== value) onChange(next);
						setProblem(null);
					} catch (error) {
						if (!(error instanceof ConstraintError)) throw error;
						setProblem(strings.mcd.problems[error.problem]);
					}
				}}
				onKeyDown={(e) => {
					if (e.key === 'Enter') e.currentTarget.blur();
				}}
			/>
			{problem && (
				<span role="alert" className="panel-problem">
					{problem}
				</span>
			)}
		</label>
	);
}

function CommentField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
	return (
		<label className="panel-field">
			<span>{strings.mcd.comment}</span>
			<textarea
				key={value}
				rows={2}
				maxLength={MAX_COMMENT}
				defaultValue={value}
				placeholder={strings.mcd.commentPlaceholder}
				onBlur={(e) => {
					const next = e.currentTarget.value.trim();
					if (next !== value) onChange(next);
				}}
			/>
		</label>
	);
}

/** An Entity's Unique groups: each one's Attributes, and a new one once two are chosen. */
function UniqueGroups({ entity }: { entity: EntityNode }) {
	const { project, diagramId } = useCanvas();
	const [draft, setDraft] = useState<string[] | null>(null);
	if (entity.attributes.length < 2) return null;
	const groups = entity.uniques ?? [];
	const save = (next: string[][]) => {
		project.stopCapturing();
		project.setUniqueGroups(diagramId, entity.id, next);
	};
	const toggled = (group: string[], id: string) =>
		group.includes(id) ? group.filter((other) => other !== id) : [...group, id];
	// An Attribute a Participant removed meanwhile does not count.
	const chosen = draft?.filter((id) => entity.attributes.some((a) => a.id === id)) ?? [];
	const choices = (group: string[], change: (group: string[]) => void, isSaved: boolean) =>
		entity.attributes.map((a) => (
			<label key={a.id}>
				<input
					type="checkbox"
					checked={group.includes(a.id)}
					// Two at least: the group itself is removed with its ×.
					disabled={isSaved && group.length === 2 && group.includes(a.id)}
					onChange={() => change(toggled(group, a.id))}
				/>
				{a.name}
			</label>
		));
	return (
		<>
			{(groups.length > 0 || draft) && <h3>{strings.mcd.uniqueGroups}</h3>}
			<ul className="attribute-editor">
				{groups.map((group, index) => (
					<li key={index}>
						<div className="attribute-row attribute-details">
							{choices(group, (next) => save(groups.with(index, next)), true)}
							<button
								aria-label={strings.mcd.removeUniqueGroup}
								onClick={() => save(groups.filter((other) => other !== group))}
							>
								×
							</button>
						</div>
					</li>
				))}
				{draft && (
					<li>
						<div className="attribute-row attribute-details">
							{choices(chosen, setDraft, false)}
						</div>
						<div className="attribute-row">
							<button
								disabled={chosen.length < 2}
								onClick={() => {
									save([...groups, chosen]);
									setDraft(null);
								}}
							>
								{strings.mcd.saveUniqueGroup}
							</button>
							<button onClick={() => setDraft(null)}>{strings.mcd.cancel}</button>
						</div>
					</li>
				)}
			</ul>
			{!draft && (
				<button className="panel-action" onClick={() => setDraft([])}>
					{strings.mcd.addUniqueGroup}
				</button>
			)}
		</>
	);
}

/** The name of the foreign key a Leg or an Inheritance link makes. */
function ForeignKeyField({ edge, label }: { edge: LegEdge | IsaEdge; label: string }) {
	const { project, diagramId } = useCanvas();
	return (
		<CheckedField
			key={edge.id}
			label={label}
			value={edge.fkName ?? ''}
			placeholder={strings.mcd.foreignKeyPlaceholder}
			onChange={(name) => project.setForeignKeyName(diagramId, edge.id, name)}
		/>
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
	const links = project
		.edges(diagramId)
		.filter((e): e is IsaEdge => e.type === 'isa' && e.source === inheritance.id);
	const children = links.map((e) => names.get(e.target));
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
			{links
				// By reference makes a foreign key; still shown while named, so that it can be cleared.
				.filter((link) => link.fkName || !inheritance.translation)
				.map((link) => (
					<ForeignKeyField
						key={link.id}
						edge={link}
						label={strings.mcd.foreignKeyOf(names.get(link.target) ?? '')}
					/>
				))}
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
	const foreignKey = foreignKeyOf(
		project
			.edges(diagramId)
			.filter((e): e is LegEdge => e.type === 'leg' && e.source === leg.source),
		leg
	);
	// In Merise only, where the row is the Leg itself (in UML, the other end's multiplicity);
	// still shown while set, so that an R that no longer applies can be cleared.
	const offered =
		nextTo === undefined &&
		(leg.relative === true || canBeRelative(project.edges(diagramId), leg.id));
	return (
		<>
			<LegCardinality leg={leg} nextTo={nextTo} nameOf={nameOf} />
			{(leg.fkName || foreignKey.makes) && (
				<ForeignKeyField
					edge={leg}
					label={strings.mcd.foreignKeyTo(nameOf(foreignKey.references))}
				/>
			)}
			{offered && (
				<label className="panel-check">
					<input
						type="checkbox"
						checked={leg.relative === true}
						onChange={(e) => {
							project.stopCapturing();
							project.setRelative(diagramId, leg.id, e.currentTarget.checked);
						}}
					/>
					{strings.mcd.relative(nameOf(leg.target))}
				</label>
			)}
		</>
	);
}

type CardinalityProps = { leg: LegEdge; nextTo?: string; nameOf: (id: string) => string };

function LegCardinality({ leg, nextTo, nameOf }: CardinalityProps) {
	const { project, diagramId } = useCanvas();
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
