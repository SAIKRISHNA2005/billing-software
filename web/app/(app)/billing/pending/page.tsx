import ComingSoon from '@/components/common/ComingSoon';

export default function PendingBillsPage() {
  return (
    <ComingSoon
      title="Pending Bills"
      phase={13}
      phaseName="Billing Frontend"
      description="Queue of completed unbilled enquiries. Select jobs belonging to the same Company and Client to generate consolidated invoices."
    />
  );
}
