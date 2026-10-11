import { describe, it, expect } from 'vitest';
import {
  extractContainersFromEnquiry,
  cleanEnquiryComments,
  embedContainersInComments,
} from './enquiryContainers';

describe('enquiryContainers utility tests', () => {
  it('extracts containers from direct array', () => {
    const enq = {
      containers: [
        { containerNumber: 'MSCU1234567', vehicleNumber: 'TN04AB1234', sealNumber: 'S1' },
        { containerNumber: 'HLBU7654321', vehicleNumber: 'TN05CD5678', sealNumber: 'S2' },
      ],
    };
    const result = extractContainersFromEnquiry(enq);
    expect(result).toHaveLength(2);
    expect(result[0].containerNumber).toBe('MSCU1234567');
    expect(result[0].vehicleNumber).toBe('TN04AB1234');
    expect(result[1].containerNumber).toBe('HLBU7654321');
    expect(result[1].vehicleNumber).toBe('TN05CD5678');
  });

  it('extracts containers from JSON string', () => {
    const enq = {
      containers: JSON.stringify([
        { containerNumber: 'MEDU1111111', vehicleNumber: 'TN01AA0001' },
        { containerNumber: 'MEDU2222222', vehicleNumber: 'TN01BB0002' },
        { containerNumber: 'MEDU3333333', vehicleNumber: 'TN01CC0003' },
      ]),
    };
    const result = extractContainersFromEnquiry(enq);
    expect(result).toHaveLength(3);
    expect(result[2].containerNumber).toBe('MEDU3333333');
    expect(result[2].vehicleNumber).toBe('TN01CC0003');
  });

  it('extracts containers embedded in comments metadata', () => {
    const rawComments = 'Urgent shipment requested\n<!--CONTAINERS:[{"containerNumber":"MSCU9999999","vehicleNumber":"TN09ZZ9999","sealNumber":"SEAL99"}]-->';
    const enq = {
      comments: rawComments,
    };
    const result = extractContainersFromEnquiry(enq);
    expect(result).toHaveLength(1);
    expect(result[0].containerNumber).toBe('MSCU9999999');
    expect(result[0].vehicleNumber).toBe('TN09ZZ9999');

    expect(cleanEnquiryComments(rawComments)).toBe('Urgent shipment requested');
  });

  it('embeds containers into comments safely', () => {
    const originalComments = 'Handled by driver Kumar';
    const containers = [
      { containerNumber: 'MSCU1234567', vehicleNumber: 'TN04AB1234' },
      { containerNumber: 'HLBU7654321', vehicleNumber: 'TN05CD5678' },
    ];
    const embedded = embedContainersInComments(originalComments, containers);
    expect(embedded).toContain('Handled by driver Kumar');
    expect(embedded).toContain('<!--CONTAINERS:');

    const extracted = extractContainersFromEnquiry({ comments: embedded });
    expect(extracted).toHaveLength(2);
    expect(extracted[0].containerNumber).toBe('MSCU1234567');
    expect(cleanEnquiryComments(embedded)).toBe('Handled by driver Kumar');
  });

  it('falls back to top-level fields when containers array/metadata is missing', () => {
    const enq = {
      containerNumber: 'TGHU1234567',
      vehicleNumber: 'TN10AA1234',
      sealNumber: 'SL-01',
      driverPhone: '9876543210',
    };
    const result = extractContainersFromEnquiry(enq);
    expect(result).toHaveLength(1);
    expect(result[0].containerNumber).toBe('TGHU1234567');
    expect(result[0].vehicleNumber).toBe('TN10AA1234');
    expect(result[0].sealNumber).toBe('SL-01');
    expect(result[0].driverPhone).toBe('9876543210');
  });
});
