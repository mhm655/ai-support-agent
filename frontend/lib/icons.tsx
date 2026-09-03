/*
 * The app's icon vocabulary, defined once over Phosphor.
 *
 * These used to be hand-drawn SVG paths. Hand-rolled icons drift: stroke
 * weights diverge, optical sizes stop matching, and every new glyph is
 * another small drawing exercise. Naming them here instead keeps the call
 * sites unchanged while the drawings come from one family at one weight.
 *
 * Imported from the /ssr entry so these work in Server Components as well
 * as client ones; the package's main entry is client-only.
 */
import {
  ArrowLeft,
  ArrowRight,
  ChartBar,
  ChatCircle,
  ChatsCircle,
  Check,
  Clock,
  Code,
  Copy,
  Eye,
  EyeSlash,
  FileText,
  Gear,
  MagnifyingGlass,
  PaperPlaneTilt,
  PencilSimple,
  Plus,
  ShieldCheck,
  SignOut,
  Sparkle,
  Spinner,
  Trash,
  UploadSimple,
  User,
  Warning,
} from "@phosphor-icons/react/dist/ssr";

type IconProps = { className?: string };

// One weight across the set. "regular" reads correctly at the 16-20px sizes
// these are used at; "bold" is reserved for glyphs sitting inside a filled
// button, where the surrounding weight is heavier.
function make(
  Glyph: React.ComponentType<{ className?: string; weight?: "regular" | "bold" }>,
  weight: "regular" | "bold" = "regular"
) {
  function Icon({ className = "h-4 w-4" }: IconProps) {
    return <Glyph className={className} weight={weight} />;
  }
  // Named so React DevTools and the lint rule see a real component, not an
  // anonymous arrow returned from a factory.
  Icon.displayName = `Icon(${Glyph.displayName ?? Glyph.name ?? "glyph"})`;
  return Icon;
}

export const ChatIcon = make(ChatCircle);
export const DocumentIcon = make(FileText);
export const UserIcon = make(User);
export const ConversationIcon = make(ChatsCircle);
export const ChartIcon = make(ChartBar);
export const SettingsIcon = make(Gear);
export const EyeIcon = make(Eye);
export const EyeOffIcon = make(EyeSlash);
export const PlusIcon = make(Plus, "bold");
export const ArrowLeftIcon = make(ArrowLeft, "bold");
export const ArrowRightIcon = make(ArrowRight, "bold");
export const CheckIcon = make(Check, "bold");
export const CopyIcon = make(Copy);
export const UploadIcon = make(UploadSimple, "bold");
export const TrashIcon = make(Trash);
export const SendIcon = make(PaperPlaneTilt, "bold");
export const LogOutIcon = make(SignOut);
export const CodeIcon = make(Code, "bold");
export const SparkIcon = make(Sparkle);
export const ShieldIcon = make(ShieldCheck);
export const ClockIcon = make(Clock);
export const PencilIcon = make(PencilSimple);
export const SearchIcon = make(MagnifyingGlass, "bold");
export const AlertIcon = make(Warning);

/* Spinner keeps its own definition because it carries the spin animation. */
export function SpinnerIcon({ className = "h-4 w-4" }: IconProps) {
  return <Spinner className={`animate-spin ${className}`} weight="bold" />;
}
