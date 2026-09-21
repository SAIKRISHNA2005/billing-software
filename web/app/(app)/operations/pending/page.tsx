import ComingSoon from '@/components/common/ComingSoon';

export default function PendingJobsPage() {
  return (
    <ComingSoon
      title="Pending Jobs"
      phase={8}
      phaseName="Operations"
      description="Active transport jobs before completion, featuring one-click 'Mark Completed' when port out time is verified."
    />
  );
}
