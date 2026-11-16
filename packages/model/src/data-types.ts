/**
 * The conceptual type of an Attribute, independent of any database; each SQL
 * target translates it. Decimal and Text(n) carry their parameters.
 */
export type DataType =
	| { kind: 'integer' }
	| { kind: 'bigint' }
	| { kind: 'decimal'; precision: number; scale: number }
	| { kind: 'text' }
	| { kind: 'varchar'; length: number }
	| { kind: 'boolean' }
	| { kind: 'date' }
	| { kind: 'datetime' }
	| { kind: 'uuid' }
	| { kind: 'serial' };

export type DataTypeKind = DataType['kind'];

export const DATA_TYPE_KINDS: readonly DataTypeKind[] = [
	'integer',
	'bigint',
	'decimal',
	'text',
	'varchar',
	'boolean',
	'date',
	'datetime',
	'uuid',
	'serial'
];

/** A type of this kind, with default parameters where it has some. */
export function dataType(kind: DataTypeKind): DataType {
	if (kind === 'decimal') return { kind, precision: 10, scale: 2 };
	if (kind === 'varchar') return { kind, length: 255 };
	return { kind };
}

const isWhole = (value: unknown, min: number, max: number): value is number =>
	Number.isInteger(value) && (value as number) >= min && (value as number) <= max;

/** Whether a value read from a file or a peer is a well-formed Data type. */
export function isDataType(value: unknown): value is DataType {
	const type = value as Partial<{
		kind: string;
		precision: unknown;
		scale: unknown;
		length: unknown;
	}>;
	if (!DATA_TYPE_KINDS.includes(type?.kind as DataTypeKind)) return false;
	if (type.kind === 'decimal') {
		return isWhole(type.precision, 1, 1000) && isWhole(type.scale, 0, type.precision as number);
	}
	if (type.kind === 'varchar') return isWhole(type.length, 1, 10_485_760);
	return true;
}
