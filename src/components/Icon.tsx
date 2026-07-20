import { icons, type LucideProps } from "lucide-react";

interface Props extends LucideProps {
  name: string;
}

export function Icon({ name, ...props }: Props) {
  const Cmp = (icons as Record<string, React.ComponentType<LucideProps>>)[name];
  if (!Cmp) {
    const Fallback = icons.Sparkles;
    return <Fallback {...props} />;
  }
  return <Cmp {...props} />;
}
