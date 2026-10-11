/**
 * Utility for extracting, embedding, and synchronizing multiple container
 * details (container number, vehicle number, seal number, driver info) across
 * Enquiry creation, retrieval, view pages, and Bill mapping.
 */

export interface MappedContainer {
  containerNumber: string;
  vehicleNumber: string;
  sealNumber: string;
  driverName?: string;
  driverPhone?: string;
}

/**
 * Normalizes a single container entry.
 */
function cleanContainerItem(item: any): MappedContainer {
  if (!item || typeof item !== 'object') {
    return {
      containerNumber: '',
      vehicleNumber: '',
      sealNumber: '',
      driverName: '',
      driverPhone: '',
    };
  }

  return {
    containerNumber: (item.containerNumber || item.containerNo || '').replace(/[\s-]/g, '').toUpperCase(),
    vehicleNumber: (item.vehicleNumber || item.vehicleNo || '').replace(/[\s-]/g, '').toUpperCase(),
    sealNumber: (item.sealNumber || '').trim(),
    driverName: (item.driverName || item.name || '').trim(),
    driverPhone: (item.driverPhone || item.phone || '').replace(/[\s-]/g, ''),
  };
}

/**
 * Extracts all mapped containers from an enquiry object.
 * Checks enquiry.containers (Array or JSON string), embedded comments metadata,
 * and falls back to primary enquiry fields.
 */
export function extractContainersFromEnquiry(enquiry: any): MappedContainer[] {
  if (!enquiry) return [];

  // 1. Direct array in enquiry.containers
  if (Array.isArray(enquiry.containers) && enquiry.containers.length > 0) {
    const list = enquiry.containers.map(cleanContainerItem).filter(hasContainerOrVehicle);
    if (list.length > 0) return list;
  }

  // 2. Direct JSON string in enquiry.containers
  if (typeof enquiry.containers === 'string' && enquiry.containers.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(enquiry.containers);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const list = parsed.map(cleanContainerItem).filter(hasContainerOrVehicle);
        if (list.length > 0) return list;
      }
    } catch {}
  }

  // 3. Embedded metadata in comments: <!--CONTAINERS:[...]--> or [CONTAINERS]: [...]
  if (typeof enquiry.comments === 'string') {
    const match =
      enquiry.comments.match(/<!--CONTAINERS:([\s\S]*?)-->/) ||
      enquiry.comments.match(/\[CONTAINERS\]:\s*(\[[\s\S]*?\])/);
    if (match && match[1]) {
      try {
        const parsed = JSON.parse(match[1]);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const list = parsed.map(cleanContainerItem).filter(hasContainerOrVehicle);
          if (list.length > 0) return list;
        }
      } catch {}
    }
  }

  // 4. Fallback from top-level primary fields
  const cNum = (enquiry.containerNumber || enquiry.containerNo || '').replace(/[\s-]/g, '').toUpperCase();
  const vNum = (enquiry.vehicleNumber || enquiry.vehicleNo || '').replace(/[\s-]/g, '').toUpperCase();
  if (cNum || vNum) {
    return [
      {
        containerNumber: cNum,
        vehicleNumber: vNum,
        sealNumber: (enquiry.sealNumber || '').trim(),
        driverName: (enquiry.driverName || '').trim(),
        driverPhone: (enquiry.driverPhone || '').replace(/[\s-]/g, ''),
      },
    ];
  }

  return [];
}

function hasContainerOrVehicle(item: MappedContainer): boolean {
  return Boolean(item.containerNumber || item.vehicleNumber);
}

/**
 * Strips embedded container metadata from user comments for clean UI display.
 */
export function cleanEnquiryComments(comments: string | undefined | null): string {
  if (!comments) return '';
  return comments
    .replace(/<!--CONTAINERS:[\s\S]*?-->/g, '')
    .replace(/\[CONTAINERS\]:\s*\[[\s\S]*?\]/g, '')
    .trim();
}

/**
 * Embeds container JSON metadata safely into enquiry comments.
 */
export function embedContainersInComments(
  comments: string | undefined | null,
  containers: any[]
): string {
  const clean = cleanEnquiryComments(comments);
  if (!containers || !Array.isArray(containers) || containers.length === 0) {
    return clean;
  }
  const serialized = JSON.stringify(containers.map(cleanContainerItem));
  return clean ? `${clean}\n<!--CONTAINERS:${serialized}-->` : `<!--CONTAINERS:${serialized}-->`;
}
