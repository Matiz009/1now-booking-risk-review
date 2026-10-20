import { Button } from '@/components/ui/Button';

type ProblemsButtonProps = {
  bookingId: string;
  /** How many signals fired. */
  count: number;
  isExpanded: boolean;
  /** The id of the details panel this button shows and hides. */
  controlsId: string;
  onToggle: () => void;
};

/**
 * The red "⚠ 3 problems" alert. The words carry the meaning; red and the icon
 * are extra cues. `aria-expanded` tells screen readers whether the details
 * below are showing.
 */
export function ProblemsButton({
  bookingId,
  count,
  isExpanded,
  controlsId,
  onToggle,
}: ProblemsButtonProps) {
  const problems = count === 1 ? '1 problem' : `${count} problems`;

  return (
    <Button
      variant="danger"
      aria-expanded={isExpanded}
      aria-controls={controlsId}
      aria-label={`Show ${problems} for ${bookingId}`}
      onClick={onToggle}
      className="whitespace-nowrap"
    >
      <span aria-hidden="true">⚠</span>
      {problems}
    </Button>
  );
}
