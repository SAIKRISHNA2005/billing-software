import ComingSoon from '@/components/common/ComingSoon';

export default function LoadingExpensesPage() {
  return (
    <ComingSoon
      title="Loading Expenses"
      phase={9}
      phaseName="Expenses"
      description="Trip-associated expenses (Diesel, Halting, Parking, Loading/Unloading charges) with automatic sync from transport enquiries."
    />
  );
}
