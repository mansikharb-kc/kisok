// RMS top bar — KC logo + location path (Floor | Block | Rack) from bound block. Phase: P1.2
// TODO: resolve location path from screen context; back/home buttons; language switcher.
export default function RmsTopBar({ token }: { token: string }) {
  return (
    <header className="flex items-center justify-between bg-gradient-to-r from-[#7c3aed] to-[#4c1d95] px-6 py-3 text-white">
      <span className="font-bold tracking-wide">KC</span>
      <span className="text-sm opacity-80">{/* TODO: 3rd Floor | Block D | Rack 2 */}token: {token}</span>
    </header>
  );
}
