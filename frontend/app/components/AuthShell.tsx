export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16 gap-8">
      <div className="flex items-center gap-3">
        <span
          className="h-2.5 w-2.5 bg-teal"
          style={{ clipPath: "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)" }}
        />
        <span className="font-display text-sm tracking-wide text-mist">
          LoL Performance Coach
        </span>
      </div>
      {children}
    </main>
  );
}
