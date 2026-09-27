'use client';

import React from 'react';
import { Tooltip, message } from 'antd';
import { useVehicleWorkStatus } from '@/lib/utils/vehicleStatusSync';

export interface VehicleStatusToggleProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  vehicleNumber?: string | null;
  enquiryId?: string;
  vehicleId?: string;
  initialStatus?: boolean;
  size?: 'small' | 'default';
  syncGlobal?: boolean;
}

export const VehicleStatusToggle: React.FC<VehicleStatusToggleProps> = ({
  checked: controlledChecked,
  onChange,
  disabled = false,
  vehicleNumber,
  enquiryId,
  vehicleId,
  initialStatus,
  size = 'default',
  syncGlobal = true,
}) => {
  // Global synchronized hook
  const { status: syncedStatus, toggle: syncedToggle, hasVehicle } = useVehicleWorkStatus(
    vehicleNumber,
    initialStatus,
    { enquiryId, vehicleId }
  );

  const isControlled = controlledChecked !== undefined;
  const isChecked = isControlled ? controlledChecked : syncedStatus;

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;

    const nextState = !isChecked;

    if (isControlled) {
      if (onChange) {
        onChange(nextState);
      }
    } else if (syncGlobal) {
      await syncedToggle(nextState);
      const vehLabel = vehicleNumber && vehicleNumber !== '-' ? `Vehicle ${vehicleNumber}` : 'Vehicle';
      if (nextState) {
        message.success(`${vehLabel} toggled ON: Sent for work`);
      } else {
        message.info(`${vehLabel} toggled OFF: Not sent for work`);
      }
      if (onChange) {
        onChange(nextState);
      }
    } else if (onChange) {
      onChange(nextState);
    }
  };

  const tooltipText = isChecked
    ? hasVehicle
      ? `Vehicle ${vehicleNumber} is SENT FOR WORK / Assigned (Click to toggle OFF)`
      : `Vehicle is SENT FOR WORK / Assigned (Click to toggle OFF)`
    : hasVehicle
    ? `Vehicle ${vehicleNumber} is NOT sent for work / In yard (Click to toggle ON)`
    : `Vehicle details not mentioned (Click to toggle ON)`;

  const width = size === 'small' ? 46 : 54;
  const height = size === 'small' ? 24 : 28;
  const circleSize = size === 'small' ? 18 : 20;

  return (
    <Tooltip title={tooltipText} placement="top">
      <div
        role="switch"
        aria-checked={isChecked}
        onClick={handleClick}
        className={`vehicle-status-toggle ${isChecked ? 'toggle-on' : 'toggle-off'}`}
        style={{
          width,
          height,
          borderRadius: height,
          opacity: disabled ? 0.6 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          position: 'relative',
        }}
      >
        <span
          className="toggle-circle"
          style={{
            width: circleSize,
            height: circleSize,
          }}
        />
      </div>
    </Tooltip>
  );
};

export default VehicleStatusToggle;
