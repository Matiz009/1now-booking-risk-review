type EmptyStateProps = {
  title: string;
  description: string;
};

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="rounded-card border-line-strong border border-dashed bg-white px-6 py-12 text-center">
      <h2 className="text-ink text-base font-bold">{title}</h2>
      <p className="text-muted mx-auto mt-1 max-w-md text-sm">{description}</p>
    </div>
  );
}
