import { isIP } from 'node:net';

/**
 * What per-address limits count a client by: an IPv4 address as is, an IPv6
 * address by its /64 (one host may hold the whole block and rotate through it),
 * an IPv4-mapped IPv6 address as its IPv4. Anything else is returned unchanged.
 */
export function addressGroup(address: string): string {
	const bare = withoutPort(address).replace(/%.*$/, '');
	if (isIP(bare) === 4) return bare;
	if (isIP(bare) !== 6) return address;
	const groups = expand(bare);
	if (groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff) {
		return [groups[6] >> 8, groups[6] & 0xff, groups[7] >> 8, groups[7] & 0xff].join('.');
	}
	return `${groups
		.slice(0, 4)
		.map((g) => g.toString(16))
		.join(':')}::/64`;
}

/** The eight 16-bit groups of a valid IPv6 address, an embedded IPv4 included. */
function expand(address: string): number[] {
	let text = address.toLowerCase();
	const ipv4 = /(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(text);
	if (ipv4) {
		const [a, b, c, d] = ipv4.slice(1).map(Number);
		text = `${text.slice(0, ipv4.index)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
	}
	const [head, tail] = text.split('::');
	const parse = (part: string | undefined) =>
		part ? part.split(':').map((g) => parseInt(g, 16)) : [];
	const start = parse(head);
	if (tail === undefined) return start;
	const end = parse(tail);
	return [...start, ...Array<number>(8 - start.length - end.length).fill(0), ...end];
}

/** A proxy may give the client's port too: `1.2.3.4:5678`, `[2001:db8::1]:443`. */
function withoutPort(address: string): string {
	const bracketed = /^\[([^\]]+)\](?::\d+)?$/.exec(address);
	if (bracketed) return bracketed[1];
	const ipv4 = /^(\d+\.\d+\.\d+\.\d+):\d+$/.exec(address);
	return ipv4 ? ipv4[1] : address;
}
