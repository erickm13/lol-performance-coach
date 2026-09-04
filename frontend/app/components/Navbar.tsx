export function Navbar() {
  return (
    <nav className="border-b border-panel-line bg-panel/70 backdrop-blur sticky top-0 z-10">
      <div className="max-w-3xl mx-auto flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <span
            className="h-2.5 w-2.5 bg-teal"
            style={{ clipPath: "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)" }}
          />
          <span className="font-display text-sm tracking-wide">
            LoL Performance Coach
          </span>
        </div>
        <span className="font-display text-sm tracking-wide text-teal">
          Dashboard
        </span>
      </div>
    </nav>
  );
}
