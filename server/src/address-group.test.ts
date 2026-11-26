import { describe, expect, it } from 'vitest';
import { addressGroup } from './address-group.ts';

describe('addressGroup', () => {
	it('keeps an IPv4 address as is', () => {
		expect(addressGroup('203.0.113.7')).toBe('203.0.113.7');
		expect(addressGroup('203.0.113.8')).not.toBe(addressGroup('203.0.113.7'));
	});

	it('groups IPv6 addresses by their /64, however they are written', () => {
		const group = '2001:db8:0:1::/64';
		expect(addressGroup('2001:db8:0:1::1')).toBe(group);
		expect(addressGroup('2001:0DB8:0000:0001:ffff:ffff:ffff:ffff')).toBe(group);
		expect(addressGroup('2001:db8::1:aaaa:bbbb:cccc:dddd'.replace('::1', ':0:1'))).toBe(group);
		expect(addressGroup('fe80::1%eth0')).toBe('fe80:0:0:0::/64');
		expect(addressGroup('::1')).toBe('0:0:0:0::/64');
		expect(addressGroup('2001:db8:0:2::1')).not.toBe(group);
	});

	it('counts an IPv4-mapped IPv6 address as its IPv4', () => {
		expect(addressGroup('::ffff:203.0.113.7')).toBe('203.0.113.7');
		expect(addressGroup('::FFFF:cb00:7107')).toBe('203.0.113.7');
	});

	it('drops a port a proxy gives with the address', () => {
		expect(addressGroup('203.0.113.7:51234')).toBe('203.0.113.7');
		expect(addressGroup('[2001:db8:0:1::1]:443')).toBe('2001:db8:0:1::/64');
		expect(addressGroup('[::ffff:203.0.113.7]')).toBe('203.0.113.7');
	});

	it('leaves what is not an address unchanged', () => {
		expect(addressGroup('unknown')).toBe('unknown');
		expect(addressGroup('')).toBe('');
	});
});
