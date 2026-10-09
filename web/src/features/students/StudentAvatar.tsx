import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

type StudentAvatarProps = { name: string; photo?: string | null; className?: string };

export function StudentAvatar({ name, photo, className }: StudentAvatarProps) {
  return (
    <Avatar className={cn("size-10", className)}>
      {photo && <AvatarImage src={photo} alt="" width={80} height={80} loading="lazy" />}
      <AvatarFallback className="bg-primary-soft font-medium text-primary">{initials(name)}</AvatarFallback>
    </Avatar>
  );
}
