/** Approximate port-area locations, not berths or navigational waypoints. */
export type Coordinate = [longitude: number, latitude: number];

export interface Port {
  readonly id: string;
  readonly name: string;
  readonly coordinates: readonly [number, number];
  readonly aliases: readonly string[];
}

export const PORTS: readonly Port[] = [
  {
    id: "CNSHA",
    name: "Port of Shanghai",
    coordinates: [121.8, 30.6],
    aliases: ["Shanghai", "CN SHA"],
  },
  {
    id: "NLRTM",
    name: "Port of Rotterdam",
    coordinates: [4.5, 51.9],
    aliases: ["Rotterdam", "NL RTM"],
  },
  {
    id: "SGSIN",
    name: "Port of Singapore",
    coordinates: [103.8, 1.3],
    aliases: ["Singapore", "SG SIN"],
  },
  {
    id: "USLAX",
    name: "Port of Los Angeles",
    coordinates: [-118.26, 33.73],
    aliases: ["Los Angeles", "US LAX"],
  },
  {
    id: "USLGB",
    name: "Port of Long Beach",
    coordinates: [-118.21, 33.75],
    aliases: ["Long Beach", "US LGB"],
  },
  {
    id: "CNSZX",
    name: "Port of Shenzhen",
    coordinates: [114.0, 22.5],
    aliases: ["Shenzhen", "CN SZX"],
  },
  {
    id: "HKHKG",
    name: "Port of Hong Kong",
    coordinates: [114.2, 22.3],
    aliases: ["Hong Kong", "HK HKG"],
  },
  {
    id: "DEHAM",
    name: "Port of Hamburg",
    coordinates: [9.9, 53.5],
    aliases: ["Hamburg", "DE HAM"],
  },
  {
    id: "USNYC",
    name: "Port of New York",
    coordinates: [-74.05, 40.67],
    aliases: ["New York", "New York and New Jersey", "NYC", "US NYC"],
  },
  {
    id: "AEDXB",
    name: "Port of Dubai",
    coordinates: [55.3, 25.3],
    aliases: ["Dubai", "Port Rashid", "AE DXB"],
  },
  {
    id: "AEJEA",
    name: "Port of Jebel Ali",
    coordinates: [55.06, 24.99],
    aliases: ["Jebel Ali", "AE JEA"],
  },
  {
    id: "KRPUS",
    name: "Port of Busan",
    coordinates: [129.0, 35.1],
    aliases: ["Busan", "Pusan", "KR PUS"],
  },
  {
    id: "TWKHH",
    name: "Port of Kaohsiung",
    coordinates: [120.3, 22.6],
    aliases: ["Kaohsiung", "TW KHH"],
  },
  {
    id: "JPTYO",
    name: "Port of Tokyo",
    coordinates: [139.8, 35.6],
    aliases: ["Tokyo", "JP TYO"],
  },
  {
    id: "INBOM",
    name: "Port of Mumbai",
    coordinates: [72.85, 18.95],
    aliases: ["Mumbai", "Bombay", "IN BOM"],
  },
  {
    id: "AUSYD",
    name: "Port of Sydney",
    coordinates: [151.2, -33.9],
    aliases: ["Sydney", "AU SYD"],
  },
  {
    id: "PHMNL",
    name: "Port of Manila",
    coordinates: [120.95, 14.6],
    aliases: ["Manila", "PH MNL"],
  },
  {
    id: "YEADE",
    name: "Port of Aden",
    coordinates: [45.0, 12.8],
    aliases: ["Aden", "YE ADE"],
  },
  {
    id: "AEFJR",
    name: "Port of Fujairah",
    coordinates: [56.36, 25.17],
    aliases: ["Fujairah", "AE FJR"],
  },
  // Keep these named areas separate from the larger port complexes.
  {
    id: "yangshan",
    name: "Yangshan Deep Water Port",
    coordinates: [122.1, 30.6],
    aliases: ["Yangshan", "Yangshan Port"],
  },
  {
    id: "europoort",
    name: "Europoort",
    coordinates: [4.1, 51.9],
    aliases: ["Port of Europoort"],
  },
];

/** Exact normalized aliases only: never guess a port from a substring. */
export function normalizePortName(name: string): string {
  return name
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/^port\s+(?:of\s+)?/, "");
}

const portsByAlias = new Map<string, Port>();
for (const port of PORTS) {
  for (const alias of [port.id, port.name, ...port.aliases]) {
    const key = normalizePortName(alias);
    const existing = portsByAlias.get(key);
    if (existing && existing.id !== port.id)
      throw new Error(`Ambiguous port alias: ${alias}`);
    portsByAlias.set(key, port);
  }
}

export function findPort(name: string): Port | undefined {
  return portsByAlias.get(normalizePortName(name));
}

export function portIdentity(name: string): string {
  return findPort(name)?.id ?? normalizePortName(name);
}

export function getPortCoordinates(name: string): Coordinate | null {
  const port = findPort(name);
  return port ? [...port.coordinates] : null;
}
