import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EFFECTIVE_DATE } from "@/lib/legal";

export function LegalPage({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-12">
      <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/" />}>
        ← 홈
      </Button>
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
        <p className="mt-1.5 text-xs text-muted-foreground">시행일: {EFFECTIVE_DATE}</p>
      </div>
      <div className="space-y-8 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </div>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

export function LegalTable({
  head,
  rows,
}: {
  head: string[];
  rows: string[][];
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-xs">
        <thead className="bg-muted text-foreground">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[0]} className="border-t border-border align-top">
              {row.map((cell, i) => (
                <td key={i} className="px-3 py-2">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
