import { useCanvas } from '../canvas/canvas-context';
import type { Selection } from '../canvas/DiagramCanvas';
import { PanelField } from '../canvas/PanelField';
import {
	CARDINALITIES,
	type AssociationNode,
	type Cardinality,
	type EntityNode,
	type LegEdge
} from '../document/project';
import {
	DATA_TYPE_KINDS,
	dataType,
	isDataType,
	type DataType,
	type DataTypeKind
} from '../document/data-types';
import { strings } from '../ui/strings';

export function McdPanel({ selection }: { selection: Selection }) {
	const { project, diagramId } = useCanvas();
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
					<LegsEditor associationId={element.id} />
				)}
			</>
		);
	}

	if (selection.edge?.type === 'leg') {
		const leg = selection.edge as LegEdge;
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

function LegsEditor({ associationId }: { associationId: string }) {
	const { project, diagramId } = useCanvas();
	const legs = project
		.edges(diagramId)
		.filter((e): e is LegEdge => e.type === 'leg' && e.source === associationId);
	return (
		<>
			<h3>{strings.mcd.legs}</h3>
			{legs.map((leg) => (
				<LegRow key={leg.id} leg={leg} />
			))}
		</>
	);
}

function LegRow({ leg }: { leg: LegEdge }) {
	const { project, diagramId } = useCanvas();
	const entity = project.nodes(diagramId).find((n) => n.id === leg.target);
	return (
		<label className="panel-field leg-row">
			<span>{String(entity?.name ?? '')}</span>
			<select
				value={leg.cardinality}
				onChange={(e) =>
					project.setCardinality(diagramId, leg.id, e.currentTarget.value as Cardinality)
				}
			>
				{CARDINALITIES.map((c) => (
					<option key={c}>{c}</option>
				))}
			</select>
		</label>
	);
}
