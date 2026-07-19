import BlueprintLoadingScreen from '@/components/page-state/BlueprintLoadingScreen';

export default function ProjectsLoading() {
  return (
    <BlueprintLoadingScreen
      message="Opening projects in the background..."
      ariaLabel="Opening projects"
    />
  );
}
