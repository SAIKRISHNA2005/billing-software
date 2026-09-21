import ComingSoon from '@/components/common/ComingSoon';

export default function MasterDataSettingsPage() {
  return (
    <ComingSoon
      title="Master Data Management"
      phase={5}
      phaseName="Master Data"
      description="Manage Companies, Clients, Vendors, Vehicles, and Drivers with search, validation rules (uppercase vehicle format, 10-digit mobile numbers), and active/inactive soft toggles."
    />
  );
}
